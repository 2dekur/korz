//! Tauri commands: argument validation and dispatch only. Logic lives in library/, audio/, smartlink.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::audio::{AudioEngine, Command, PlayerState};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::library::models::*;
use crate::library::{queries, scan};
use crate::smartlink::{self, LinkInfo};

pub struct AppState {
    pub db: Arc<Db>,
    pub engine: AudioEngine,
    pub covers: PathBuf,
    pub scanning: Arc<AtomicBool>,
}

const MAX_IDS: usize = 20_000;

/// Runs blocking work (SQLite, disk) off the async runtime threads.
async fn blocking<T: Send + 'static>(f: impl FnOnce() -> AppResult<T> + Send + 'static) -> AppResult<T> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| AppError::Invalid(format!("tâche interrompue : {e}")))?
}

fn db(state: &State<'_, AppState>) -> Arc<Db> {
    state.db.clone()
}

fn check_ids(ids: &[i64]) -> AppResult<()> {
    if ids.len() > MAX_IDS {
        return Err(AppError::Invalid("Trop de titres en une seule demande".into()));
    }
    Ok(())
}

fn clamp_limit(limit: i64) -> i64 {
    limit.clamp(1, 200)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    version: String,
    data_dir: String,
    log_dir: String,
}

#[tauri::command]
pub async fn app_info(app: AppHandle) -> AppResult<AppInfo> {
    let path = app.path();
    let dir = |p: tauri::Result<PathBuf>| p.map(|p| p.display().to_string()).unwrap_or_default();
    Ok(AppInfo { version: app.package_info().version.to_string(), data_dir: dir(path.app_data_dir()), log_dir: dir(path.app_log_dir()) })
}

// ── Library ──────────────────────────────────────────────────────────────────

/// One scan at a time: a second request is refused rather than queued behind the first.
async fn run_scan(app: AppHandle, state: State<'_, AppState>, folder: Option<String>) -> AppResult<ScanSummary> {
    if state.scanning.swap(true, Ordering::SeqCst) {
        return Err(AppError::Invalid("Une analyse est déjà en cours".into()));
    }
    let (db, covers, flag) = (db(&state), state.covers.clone(), state.scanning.clone());
    let result = blocking(move || {
        let progress = |p: ScanProgress| {
            let _ = app.emit("library://scan", p);
        };
        match folder {
            Some(path) => scan::add_folder(&db, &covers, &path, &progress),
            None => scan::rescan_all(&db, &covers, &progress),
        }
    })
    .await;
    flag.store(false, Ordering::SeqCst);
    result
}

#[tauri::command]
pub async fn library_add_folder(app: AppHandle, state: State<'_, AppState>, path: String) -> AppResult<ScanSummary> {
    run_scan(app, state, Some(path)).await
}

#[tauri::command]
pub async fn library_rescan(app: AppHandle, state: State<'_, AppState>) -> AppResult<ScanSummary> {
    run_scan(app, state, None).await
}

#[tauri::command]
pub async fn library_folders(state: State<'_, AppState>) -> AppResult<Vec<Folder>> {
    let db = db(&state);
    blocking(move || db.with(|c| queries::folders(c))).await
}

#[tauri::command]
pub async fn library_remove_folder(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    if state.scanning.load(Ordering::SeqCst) {
        return Err(AppError::Invalid("Attendez la fin de l'analyse en cours".into()));
    }
    let db = db(&state);
    blocking(move || db.with(|c| queries::remove_folder(c, id))).await
}

#[tauri::command]
pub async fn library_stats(state: State<'_, AppState>) -> AppResult<LibraryStats> {
    let db = db(&state);
    blocking(move || db.with(|c| queries::stats(c))).await
}

#[tauri::command]
pub async fn library_tracks(state: State<'_, AppState>, query: TrackQuery) -> AppResult<Vec<Track>> {
    let db = db(&state);
    blocking(move || db.with(|c| queries::tracks(c, &query))).await
}

#[tauri::command]
pub async fn library_albums(state: State<'_, AppState>, artist: Option<String>) -> AppResult<Vec<Album>> {
    let db = db(&state);
    blocking(move || db.with(|c| queries::albums(c, artist.as_deref()))).await
}

#[tauri::command]
pub async fn library_recent_albums(state: State<'_, AppState>, limit: i64) -> AppResult<Vec<Album>> {
    let db = db(&state);
    blocking(move || db.with(|c| queries::recent_albums(c, clamp_limit(limit)))).await
}

#[tauri::command]
pub async fn library_artists(state: State<'_, AppState>) -> AppResult<Vec<Artist>> {
    let db = db(&state);
    blocking(move || db.with(|c| queries::artists(c))).await
}

#[tauri::command]
pub async fn history_recent(state: State<'_, AppState>, limit: i64) -> AppResult<Vec<Track>> {
    let db = db(&state);
    blocking(move || db.with(|c| queries::recent_history(c, clamp_limit(limit)))).await
}

#[tauri::command]
pub async fn favorite_toggle(state: State<'_, AppState>, track_id: i64) -> AppResult<bool> {
    let db = db(&state);
    let favorite = blocking(move || db.with(|c| queries::toggle_favorite(c, track_id))).await?;
    state.engine.send(Command::Favorite(track_id, favorite))?;
    Ok(favorite)
}

// ── Playlists ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn playlists_list(state: State<'_, AppState>) -> AppResult<Vec<Playlist>> {
    let db = db(&state);
    blocking(move || db.with(|c| queries::playlists(c))).await
}

#[tauri::command]
pub async fn playlist_get(state: State<'_, AppState>, id: i64) -> AppResult<PlaylistDetail> {
    let db = db(&state);
    blocking(move || db.with(|c| queries::playlist_get(c, id))).await
}

#[tauri::command]
pub async fn playlist_create(state: State<'_, AppState>, name: String) -> AppResult<Playlist> {
    let db = db(&state);
    blocking(move || db.with(|c| queries::playlist_create(c, &name))).await
}

#[tauri::command]
pub async fn playlist_rename(state: State<'_, AppState>, id: i64, name: String) -> AppResult<()> {
    let db = db(&state);
    blocking(move || db.with(|c| queries::playlist_rename(c, id, &name))).await
}

#[tauri::command]
pub async fn playlist_delete(state: State<'_, AppState>, id: i64) -> AppResult<()> {
    let db = db(&state);
    blocking(move || db.with(|c| queries::playlist_delete(c, id))).await
}

#[tauri::command]
pub async fn playlist_add(state: State<'_, AppState>, id: i64, track_ids: Vec<i64>) -> AppResult<()> {
    check_ids(&track_ids)?;
    let db = db(&state);
    blocking(move || db.with(|c| queries::playlist_add(c, id, &track_ids))).await
}

#[tauri::command]
pub async fn playlist_remove(state: State<'_, AppState>, id: i64, position: i64) -> AppResult<()> {
    let db = db(&state);
    blocking(move || db.with(|c| queries::playlist_remove(c, id, position))).await
}

// ── Player ───────────────────────────────────────────────────────────────────

async fn load_tracks(state: &State<'_, AppState>, ids: Vec<i64>) -> AppResult<Vec<Track>> {
    check_ids(&ids)?;
    let db = db(state);
    blocking(move || db.with(|c| queries::tracks_by_ids(c, &ids))).await
}

#[tauri::command]
pub async fn player_play(state: State<'_, AppState>, track_ids: Vec<i64>, index: usize) -> AppResult<()> {
    let tracks = load_tracks(&state, track_ids).await?;
    if tracks.is_empty() {
        return Err(AppError::NotFound("titres à lire".into()));
    }
    state.engine.send(Command::Play(tracks, index))
}

#[tauri::command]
pub async fn player_enqueue(state: State<'_, AppState>, track_ids: Vec<i64>) -> AppResult<()> {
    let tracks = load_tracks(&state, track_ids).await?;
    state.engine.send(Command::Enqueue(tracks))
}

#[tauri::command]
pub async fn player_jump(state: State<'_, AppState>, index: usize) -> AppResult<()> {
    state.engine.send(Command::Jump(index))
}

#[tauri::command]
pub async fn player_toggle(state: State<'_, AppState>) -> AppResult<()> {
    state.engine.send(Command::Toggle)
}

#[tauri::command]
pub async fn player_next(state: State<'_, AppState>) -> AppResult<()> {
    state.engine.send(Command::Next)
}

#[tauri::command]
pub async fn player_previous(state: State<'_, AppState>) -> AppResult<()> {
    state.engine.send(Command::Previous)
}

#[tauri::command]
pub async fn player_seek(state: State<'_, AppState>, position_ms: u64) -> AppResult<()> {
    state.engine.send(Command::Seek(Duration::from_millis(position_ms)))
}

#[tauri::command]
pub async fn player_set_volume(state: State<'_, AppState>, volume: f32) -> AppResult<()> {
    if !volume.is_finite() || !(0.0..=1.0).contains(&volume) {
        return Err(AppError::Invalid("Volume hors limites".into()));
    }
    state.engine.send(Command::SetVolume(volume))?;
    let db = db(&state);
    blocking(move || db.set_setting("volume", &volume.to_string())).await
}

#[tauri::command]
pub async fn player_state(state: State<'_, AppState>) -> AppResult<PlayerState> {
    Ok(state.engine.state())
}

// ── Smart Link ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn smartlink_parse(url: String) -> AppResult<LinkInfo> {
    if url.len() > 2048 {
        return Err(AppError::Invalid("Lien trop long".into()));
    }
    smartlink::parse(&url)
}

/// `korzcover://localhost/<hash>`: cached cover images, by content hash only.
pub fn cover_response(app: &AppHandle, request: &tauri::http::Request<Vec<u8>>) -> tauri::http::Response<Vec<u8>> {
    let name = request.uri().path().trim_start_matches('/');
    let bytes = app
        .try_state::<AppState>()
        .filter(|_| scan::is_cover_name(name))
        .and_then(|s| std::fs::read(s.covers.join(name)).ok());
    let builder = tauri::http::Response::builder();
    match bytes {
        Some(bytes) => {
            let mime = match bytes.get(..4) {
                Some([0xFF, 0xD8, ..]) => "image/jpeg",
                Some([0x89, b'P', b'N', b'G']) => "image/png",
                Some([b'G', b'I', b'F', _]) => "image/gif",
                Some([b'R', b'I', b'F', b'F']) => "image/webp",
                _ => "application/octet-stream",
            };
            builder
                .header("Content-Type", mime)
                .header("Cache-Control", "max-age=31536000, immutable")
                .body(bytes)
        }
        None => builder.status(404).body(Vec::new()),
    }
    .unwrap_or_default()
}
