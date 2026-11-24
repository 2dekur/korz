//! KORZ AUDIO ENGINE — decoding (symphonia via rodio) and output on a dedicated thread.
//!
//! The OS audio stream is not `Send`, so one thread owns it and receives commands over a channel.
//! The frontend only mirrors the state the engine publishes (`player://state`, `player://position`).

mod queue;

use std::fs::File;
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

use rodio::{Decoder, DeviceSinkBuilder, MixerDeviceSink, Player};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::library::{models::Track, queries};
use queue::Queue;

const TICK: Duration = Duration::from_millis(250);
/// "Previous" restarts the current track when it has played longer than this.
const RESTART_THRESHOLD: Duration = Duration::from_secs(3);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Idle,
    Playing,
    Paused,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerState {
    pub status: Status,
    pub queue: Vec<Track>,
    pub index: Option<usize>,
    pub volume: f32,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
struct Position {
    position_ms: u64,
    duration_ms: u64,
}

pub enum Command {
    Play(Vec<Track>, usize),
    Enqueue(Vec<Track>),
    Jump(usize),
    Toggle,
    Next,
    Previous,
    Seek(Duration),
    SetVolume(f32),
    /// Keeps the queued copies of a track in sync with the favorites table.
    Favorite(i64, bool),
    Shutdown,
}

pub struct AudioEngine {
    tx: Sender<Command>,
    state: Arc<Mutex<PlayerState>>,
    thread: Mutex<Option<JoinHandle<()>>>,
}

impl AudioEngine {
    pub fn start(app: AppHandle, db: Arc<Db>, volume: f32) -> Self {
        let (tx, rx) = mpsc::channel();
        let state = Arc::new(Mutex::new(PlayerState { status: Status::Idle, queue: Vec::new(), index: None, volume, error: None }));
        let shared = state.clone();
        let thread = std::thread::Builder::new()
            .name("korz-audio".into())
            .spawn(move || {
                let mut engine = Engine { app, db, shared, queue: Queue::default(), output: None, status: Status::Idle, volume, error: None };
                loop {
                    match rx.recv_timeout(TICK) {
                        Ok(Command::Shutdown) | Err(RecvTimeoutError::Disconnected) => break,
                        Ok(cmd) => engine.handle(cmd),
                        Err(RecvTimeoutError::Timeout) => {}
                    }
                    engine.tick();
                }
                log::info!("moteur audio arrêté");
            })
            .expect("audio thread");
        Self { tx, state, thread: Mutex::new(Some(thread)) }
    }

    pub fn send(&self, cmd: Command) -> AppResult<()> {
        self.tx.send(cmd).map_err(|_| AppError::Audio("le moteur audio ne répond plus".into()))
    }

    pub fn state(&self) -> PlayerState {
        self.state.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }

    /// Stops playback and waits for the audio thread, so the device is released cleanly on exit.
    pub fn shutdown(&self) {
        let _ = self.tx.send(Command::Shutdown);
        if let Some(handle) = self.thread.lock().unwrap_or_else(|e| e.into_inner()).take() {
            let _ = handle.join();
        }
    }
}

/// The device and a player for the current track. A fresh `Player` per track: dropping the old
/// one stops it immediately, whereas `Player::clear` blocks until the audio thread acknowledges.
struct Output {
    device: MixerDeviceSink,
    player: Option<Player>,
}

struct Engine {
    app: AppHandle,
    db: Arc<Db>,
    shared: Arc<Mutex<PlayerState>>,
    queue: Queue,
    output: Option<Output>,
    status: Status,
    volume: f32,
    error: Option<String>,
}

/// Perceived loudness is closer to linear with a squared gain.
fn gain(volume: f32) -> f32 {
    volume * volume
}

impl Engine {
    fn handle(&mut self, cmd: Command) {
        match cmd {
            Command::Play(tracks, start) => {
                let target = self.queue.replace(tracks, start).cloned();
                self.load(target);
            }
            Command::Enqueue(tracks) => {
                let was_empty = self.queue.current().is_none();
                self.queue.append(tracks);
                if was_empty {
                    let target = self.queue.next().cloned();
                    self.load(target);
                }
            }
            Command::Jump(i) => {
                let target = self.queue.jump(i).cloned();
                if target.is_some() {
                    self.load(target);
                }
            }
            Command::Toggle => match (self.status, self.player()) {
                (Status::Playing, Some(p)) => {
                    p.pause();
                    self.status = Status::Paused;
                }
                (Status::Paused, Some(p)) => {
                    p.play();
                    self.status = Status::Playing;
                }
                // Idle (finished or failed): replay the current track from the start.
                _ => {
                    let target = self.queue.current().cloned();
                    self.load(target);
                }
            },
            Command::Next => {
                if let Some(t) = self.queue.next().cloned() {
                    self.load(Some(t));
                }
            }
            Command::Previous => {
                let played = self.player().map_or(Duration::ZERO, |p| p.get_pos());
                if played > RESTART_THRESHOLD || self.queue.index == Some(0) {
                    let target = self.queue.current().cloned();
                    self.load(target);
                } else if let Some(t) = self.queue.previous().cloned() {
                    self.load(Some(t));
                }
            }
            Command::Seek(pos) => {
                if let Some(p) = self.player() {
                    if let Err(e) = p.try_seek(pos) {
                        log::warn!("déplacement impossible : {e}");
                        self.error = Some("Ce fichier ne permet pas de se déplacer dans la lecture".into());
                    }
                }
                self.emit_position();
            }
            Command::SetVolume(v) => {
                self.volume = v;
                if let Some(p) = self.player() {
                    p.set_volume(gain(v));
                }
            }
            Command::Favorite(id, favorite) => {
                for t in self.queue.tracks.iter_mut().filter(|t| t.id == id) {
                    t.favorite = favorite;
                }
            }
            Command::Shutdown => {}
        }
        self.publish();
    }

    fn player(&self) -> Option<&Player> {
        self.output.as_ref()?.player.as_ref()
    }

    /// Opened lazily and reopened after a failure, so plugging a device in later works.
    fn device(&mut self) -> AppResult<&mut Output> {
        if self.output.is_none() {
            let mut device = DeviceSinkBuilder::open_default_sink().map_err(|e| AppError::Audio(format!("aucune sortie audio disponible ({e})")))?;
            device.log_on_drop(false);
            self.output = Some(Output { device, player: None });
        }
        Ok(self.output.as_mut().expect("just set"))
    }

    fn load(&mut self, track: Option<Track>) {
        let Some(track) = track else {
            self.stop();
            return;
        };
        match self.start(&track) {
            Ok(()) => {
                self.status = Status::Playing;
                self.error = None;
                if let Err(e) = self.db.with(|c| queries::record_play(c, track.id)) {
                    log::warn!("historique non enregistré : {e}");
                }
                log::info!("lecture : {} ({})", track.title, track.format);
            }
            Err(e) => {
                log::error!("lecture impossible de {} : {e}", track.path);
                self.stop();
                self.error = Some(format!("{} — {e}", track.title));
            }
        }
    }

    fn start(&mut self, track: &Track) -> AppResult<()> {
        let file = File::open(&track.path).map_err(|e| match e.kind() {
            std::io::ErrorKind::NotFound => AppError::NotFound("fichier déplacé ou supprimé".into()),
            _ => AppError::Io(e),
        })?;
        let source = Decoder::try_from(file).map_err(|e| AppError::Audio(format!("format non pris en charge ({e})")))?;
        let volume = gain(self.volume);
        let out = self.device()?;
        out.player = None;
        let player = Player::connect_new(out.device.mixer());
        player.set_volume(volume);
        player.append(source);
        out.player = Some(player);
        Ok(())
    }

    fn stop(&mut self) {
        if let Some(out) = self.output.as_mut() {
            out.player = None;
        }
        self.status = Status::Idle;
        self.emit_position();
    }

    fn tick(&mut self) {
        if self.status != Status::Playing {
            return;
        }
        if self.player().is_some_and(|p| p.empty()) {
            let next = self.queue.next().cloned();
            match next {
                Some(t) => self.load(Some(t)),
                None => self.stop(),
            }
            self.publish();
        }
        self.emit_position();
    }

    fn emit_position(&self) {
        let position_ms = self.player().map_or(0, |p| p.get_pos().as_millis() as u64);
        let duration_ms = self.queue.current().map_or(0, |t| t.duration_ms.max(0) as u64);
        let position_ms = if duration_ms > 0 { position_ms.min(duration_ms) } else { position_ms };
        let _ = self.app.emit("player://position", Position { position_ms, duration_ms });
    }

    fn publish(&self) {
        let snapshot = PlayerState {
            status: self.status,
            queue: self.queue.tracks.clone(),
            index: self.queue.index,
            volume: self.volume,
            error: self.error.clone(),
        };
        *self.shared.lock().unwrap_or_else(|e| e.into_inner()) = snapshot.clone();
        if let Err(e) = self.app.emit("player://state", snapshot) {
            log::warn!("état du lecteur non transmis : {e}");
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use rodio::Source;

    use super::*;

    /// Real files for every promised format (generated with ffmpeg, see CLAUDE.md):
    /// `KORZ_FIXTURES=<dir> cargo test formats -- --ignored --nocapture`
    #[test]
    #[ignore = "needs KORZ_FIXTURES"]
    fn formats_read_decode_and_seek() {
        let dir = std::env::var("KORZ_FIXTURES").expect("KORZ_FIXTURES");
        let covers = std::env::temp_dir().join(format!("korz-covers-{}", std::process::id()));
        std::fs::create_dir_all(&covers).unwrap();
        for name in ["t.mp3", "t.flac", "t.wav", "t.aac", "t.m4a", "t-alac.m4a", "t.ogg"] {
            let path = Path::new(&dir).join(name);
            let meta = crate::library::scan::read_track(&path, path.to_str().unwrap(), &covers, 0, 0).unwrap_or_else(|e| panic!("{name} tags: {e}"));
            // Raw ADTS AAC has no index: its duration is estimated from the bitrate.
            let range = if name == "t.aac" { 5_700..=6_400 } else { 5_900..=6_100 };
            assert!(range.contains(&meta.duration_ms), "{name}: duration {}", meta.duration_ms);
            // Raw ADTS AAC has no tag container: the file name stands in for the title.
            if name != "t.aac" {
                assert_eq!((meta.title.as_str(), meta.album_artist.as_str(), meta.track_no), ("Essai", "Korz", Some(3)), "{name}");
            }
            let mut dec = Decoder::try_from(File::open(&path).unwrap()).unwrap_or_else(|e| panic!("{name} decode: {e}"));
            dec.try_seek(Duration::from_secs(3)).unwrap_or_else(|e| panic!("{name} seek: {e}"));
            let per_sec = f64::from(dec.sample_rate().get()) * f64::from(dec.channels().get());
            let left = dec.by_ref().count() as f64 / per_sec;
            assert!((2.7..3.3).contains(&left), "{name}: {left:.2}s left after seeking to 3s");
            eprintln!("{name:12} ok  {} ms  cover={}  {left:.2}s after seek", meta.duration_ms, meta.cover.is_some());
        }
        std::fs::remove_dir_all(&covers).unwrap();
    }
}
