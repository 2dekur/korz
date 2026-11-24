//! Smart Link pipeline: what a pasted link is, what it contains, which local tracks match it,
//! and whether to play at once or ask first (user setting). The local player never depends on it.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::direct::{self, Probe};
use super::matching::{self, Confidence, Query};
use super::{parse, LinkInfo};
use crate::commands::AppState;
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::library::models::Track;
use crate::library::{queries, scan};

pub const BEHAVIOR_KEY: &str = "link_behavior";
pub const IMPORT_DIR_KEY: &str = "import_dir";
const MAX_CANDIDATES: usize = 5;
const MAX_URL: usize = 2048;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Behavior {
    #[default]
    Auto,
    AlwaysConfirm,
    Instant,
}

impl Behavior {
    fn key(self) -> &'static str {
        match self {
            Behavior::Auto => "auto",
            Behavior::AlwaysConfirm => "always_confirm",
            Behavior::Instant => "instant",
        }
    }

    fn from_key(s: &str) -> Option<Self> {
        [Behavior::Auto, Behavior::AlwaysConfirm, Behavior::Instant].into_iter().find(|b| b.key() == s)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Decision {
    Play,
    Confirm,
}

/// `candidates` sorted best first. Nothing playable always asks; "auto" plays only a single,
/// high-confidence match.
pub fn decide(behavior: Behavior, candidates: &[Confidence]) -> Decision {
    match (behavior, candidates) {
        (_, []) => Decision::Confirm,
        (Behavior::Instant, _) => Decision::Play,
        (Behavior::AlwaysConfirm, _) => Decision::Confirm,
        (Behavior::Auto, [Confidence::High]) => Decision::Play,
        (Behavior::Auto, _) => Decision::Confirm,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Source {
    DirectAudio,
    Youtube,
    Spotify,
    Unsupported,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkMeta {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub artwork_url: Option<String>,
    pub format: Option<String>,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CandidateKind {
    /// A track of the local library.
    Local,
    /// The linked file itself.
    Direct,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub kind: CandidateKind,
    pub track: Option<Track>,
    pub confidence: Confidence,
    pub score: f32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkResolution {
    pub url: String,
    pub source: Source,
    /// Display name of the service, also for recognised but unsupported ones.
    pub provider: Option<String>,
    pub kind: Option<String>,
    pub meta: LinkMeta,
    pub candidates: Vec<Candidate>,
    pub decision: Decision,
    /// Only direct audio files may be saved into the library.
    pub importable: bool,
    /// Official page of the service, opened in the browser on request.
    pub open_url: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkSettings {
    pub behavior: Behavior,
    pub import_dir: String,
    pub is_default_dir: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub track: Track,
    pub duplicate: bool,
}

fn provider_name(id: &str) -> &'static str {
    match id {
        "youtube" => "YouTube",
        "spotify" => "Spotify",
        "deezer" => "Deezer",
        "apple-music" => "Apple Music",
        "soundcloud" => "SoundCloud",
        _ => "Service inconnu",
    }
}

#[derive(Debug, PartialEq)]
enum Classified {
    Service(LinkInfo),
    /// Any other http(s) link: maybe a direct audio file, decided by its headers and bytes.
    Web,
}

fn classify(url: &str) -> AppResult<Classified> {
    if url.len() > MAX_URL {
        return Err(AppError::Invalid("Lien trop long".into()));
    }
    match parse(url) {
        Ok(info) => Ok(Classified::Service(info)),
        Err(_) if url.starts_with("https://") || url.starts_with("http://") => Ok(Classified::Web),
        Err(e) => Err(e),
    }
}

/// Canonical public page, used for oEmbed and for "open in the service".
fn canonical(info: &LinkInfo) -> Option<String> {
    let id = info.id.as_deref()?;
    match (info.provider, info.kind) {
        ("youtube", "playlist") => Some(format!("https://www.youtube.com/playlist?list={id}")),
        ("youtube", _) => Some(format!("https://www.youtube.com/watch?v={id}")),
        ("spotify", kind) => Some(format!("https://open.spotify.com/{kind}/{id}")),
        _ => None,
    }
}

pub fn behavior(db: &Db) -> AppResult<Behavior> {
    Ok(db.setting(BEHAVIOR_KEY)?.as_deref().and_then(Behavior::from_key).unwrap_or_default())
}

pub fn set_behavior(db: &Db, b: Behavior) -> AppResult<()> {
    db.set_setting(BEHAVIOR_KEY, b.key())
}

pub fn import_dir(state: &AppState) -> AppResult<PathBuf> {
    Ok(state.db.setting(IMPORT_DIR_KEY)?.map(PathBuf::from).unwrap_or_else(|| state.default_import_dir.clone()))
}

pub fn settings(state: &AppState) -> AppResult<LinkSettings> {
    let custom = state.db.setting(IMPORT_DIR_KEY)?;
    Ok(LinkSettings {
        behavior: behavior(&state.db)?,
        import_dir: import_dir(state)?.display().to_string(),
        is_default_dir: custom.is_none(),
    })
}

/// Refuses a folder that would contain an existing library folder: its tracks would belong to two folders.
fn check_import_dir(c: &Connection, dir: &Path) -> AppResult<()> {
    let folders = queries::folders(c)?;
    if folders.iter().any(|f| dir.starts_with(&f.path)) {
        return Ok(());
    }
    if let Some(f) = folders.iter().find(|f| Path::new(&f.path).starts_with(dir)) {
        return Err(AppError::Invalid(format!("Ce dossier contient déjà un dossier de la bibliothèque ({}) : choisissez-en un autre", f.path)));
    }
    Ok(())
}

pub fn set_import_dir(state: &AppState, raw: &str) -> AppResult<LinkSettings> {
    let dir = scan::canonical_dir(raw)?;
    state.db.with(|c| check_import_dir(c, &dir))?;
    state.db.set_setting(IMPORT_DIR_KEY, &dir.display().to_string())?;
    settings(state)
}

/// Library folder that will own files imported into `dir`; the import folder is added if needed.
fn folder_for_import(c: &Connection, dir: &Path) -> AppResult<i64> {
    check_import_dir(c, dir)?;
    if let Some(f) = queries::folders(c)?.into_iter().find(|f| dir.starts_with(&f.path)) {
        return Ok(f.id);
    }
    let path = dir.to_str().ok_or_else(|| AppError::Invalid("Chemin du dossier d'import illisible".into()))?;
    queries::insert_folder(c, path)
}

pub async fn resolve(state: &AppState, raw: &str) -> AppResult<LinkResolution> {
    let url = raw.trim();
    let behavior = behavior(&state.db)?;
    let mut res = match classify(url)? {
        Classified::Service(info) if matches!(info.provider, "youtube" | "spotify") => service(state, url, &info).await?,
        Classified::Service(info) => {
            let name = provider_name(info.provider);
            unsupported(url, Some(name), Some(info.kind), format!("Lien {name} reconnu, mais ce service n'est pas encore pris en charge."))
        }
        Classified::Web => match direct::probe(&state.http, url).await {
            Ok(probe) => direct_resolution(url, probe),
            Err(AppError::Invalid(msg)) => unsupported(url, None, None, msg),
            Err(e) => return Err(e),
        },
    };
    res.decision = decide(behavior, &res.candidates.iter().map(|c| c.confidence).collect::<Vec<_>>());
    log::info!("lien {:?} : {} correspondance(s), décision {:?}", res.source, res.candidates.len(), res.decision);
    Ok(res)
}

fn unsupported(url: &str, provider: Option<&str>, kind: Option<&str>, message: String) -> LinkResolution {
    LinkResolution {
        url: url.to_string(),
        source: Source::Unsupported,
        provider: provider.map(str::to_string),
        kind: kind.map(str::to_string),
        meta: LinkMeta::default(),
        candidates: Vec::new(),
        decision: Decision::Confirm,
        importable: false,
        open_url: None,
        message: Some(message),
    }
}

fn direct_resolution(url: &str, p: Probe) -> LinkResolution {
    LinkResolution {
        url: url.to_string(),
        source: Source::DirectAudio,
        provider: Some("Lien direct".into()),
        kind: Some("track".into()),
        meta: LinkMeta { title: Some(p.stem), format: Some(p.format.label().into()), size_bytes: p.size, ..Default::default() },
        candidates: vec![Candidate { kind: CandidateKind::Direct, track: None, confidence: direct::confidence(p.check), score: 1.0 }],
        decision: Decision::Confirm,
        importable: true,
        open_url: None,
        message: None,
    }
}

#[derive(Deserialize)]
struct OEmbed {
    title: String,
    author_name: Option<String>,
    thumbnail_url: Option<String>,
}

/// Public oEmbed endpoints of YouTube and Spotify: title, author and artwork, no key, no scraping.
async fn oembed(client: &reqwest::Client, provider: &str, page: &str) -> Option<OEmbed> {
    let endpoint = match provider {
        "youtube" => reqwest::Url::parse_with_params("https://www.youtube.com/oembed", &[("format", "json"), ("url", page)]),
        _ => reqwest::Url::parse_with_params("https://open.spotify.com/oembed", &[("url", page)]),
    }
    .ok()?;
    let resp = client.get(endpoint).send().await.map_err(|e| e.without_url()).inspect_err(|e| log::warn!("oEmbed {provider} : {e}")).ok()?;
    if !resp.status().is_success() {
        log::warn!("oEmbed {provider} : HTTP {}", resp.status());
        return None;
    }
    serde_json::from_slice(&resp.bytes().await.ok()?).inspect_err(|e| log::warn!("oEmbed {provider} illisible : {e}")).ok()
}

async fn service(state: &AppState, url: &str, info: &LinkInfo) -> AppResult<LinkResolution> {
    let source = if info.provider == "youtube" { Source::Youtube } else { Source::Spotify };
    let page = canonical(info);
    let mut res = LinkResolution {
        url: url.to_string(),
        source,
        provider: Some(provider_name(info.provider).into()),
        kind: Some(info.kind.into()),
        meta: LinkMeta::default(),
        candidates: Vec::new(),
        decision: Decision::Confirm,
        importable: false,
        open_url: page.clone(),
        message: None,
    };
    let Some(page) = page else {
        res.message = Some("Ce lien ne désigne pas un contenu précis.".into());
        return Ok(res);
    };
    let Some(o) = oembed(&state.http, info.provider, &page).await else {
        res.message = Some("Informations du lien indisponibles (hors ligne, contenu privé ou supprimé).".into());
        return Ok(res);
    };
    let artist = o.author_name.as_deref().map(matching::clean_author).filter(|a| !a.is_empty());
    // Spotify's oEmbed author is the service itself, not the artist.
    let artist = if source == Source::Spotify { None } else { artist };
    let query = Query::new(&o.title, artist.as_deref());
    let words = query.key_words(6);
    let mut scored: Vec<(f32, Track)> = state
        .db
        .with(|c| queries::tracks_matching(c, &words))?
        .into_iter()
        .map(|t| (query.score(&t.title, &t.artist), t))
        .filter(|(s, _)| matching::confidence(*s).is_some())
        .collect();
    scored.sort_by(|a, b| b.0.total_cmp(&a.0));
    scored.truncate(MAX_CANDIDATES);
    res.candidates = scored
        .into_iter()
        .map(|(score, track)| Candidate { kind: CandidateKind::Local, confidence: matching::confidence(score).unwrap_or(Confidence::Low), score, track: Some(track) })
        .collect();
    if res.candidates.is_empty() {
        res.message = Some("Aucun titre correspondant dans votre bibliothèque.".into());
    }
    res.meta = LinkMeta { title: Some(o.title), artist, artwork_url: o.thumbnail_url, ..Default::default() };
    Ok(res)
}

fn url_key(url: &str) -> String {
    Sha256::digest(url.as_bytes()).iter().take(12).map(|b| format!("{b:02x}")).collect()
}

/// Track for a file outside the library: negative id, so it is never written to favorites,
/// playlists or history.
fn ephemeral(state: &AppState, path: &Path, fallback_title: &str) -> AppResult<Track> {
    let path_str = path.to_str().ok_or_else(|| AppError::Invalid("Chemin illisible".into()))?;
    let meta = fs::metadata(path)?;
    let t = scan::read_track(path, path_str, &state.covers, meta.len() as i64, 0)?;
    let from_tags = path.file_stem().and_then(|s| s.to_str()) != Some(t.title.as_str());
    Ok(Track {
        id: state.ephemeral.fetch_sub(1, Ordering::SeqCst),
        path: t.path,
        title: if from_tags { t.title } else { fallback_title.to_string() },
        artist: t.artist,
        album: t.album,
        album_artist: t.album_artist,
        genre: t.genre,
        track_no: t.track_no,
        disc_no: t.disc_no,
        year: t.year,
        duration_ms: t.duration_ms,
        format: t.format,
        cover: t.cover,
        favorite: false,
    })
}

/// Downloads a direct link into the temporary cache (reused if already there) for playback.
pub async fn cache_direct(state: &AppState, url: &str) -> AppResult<Track> {
    let key = url_key(url.trim());
    let cached = ["mp3", "flac", "wav", "ogg", "m4a", "aac"].iter().map(|e| state.links_cache.join(format!("{key}.{e}"))).find(|p| p.is_file());
    let (path, title) = match cached {
        Some(p) => (p, direct::name_from(url, None)),
        None => {
            let (part, format, stem) = direct::download_part(&state.http, url.trim(), &state.links_cache).await?;
            let target = state.links_cache.join(format!("{key}.{}", format.ext()));
            fs::rename(&part, &target)?;
            (target, stem)
        }
    };
    ephemeral(state, &path, &title)
}

/// Downloads a direct link into the import folder and adds it to the library.
pub async fn import_direct(state: &AppState, url: &str) -> AppResult<ImportResult> {
    let dir = import_dir(state)?;
    fs::create_dir_all(&dir)?;
    let dir = scan::canonical_dir(dir.to_str().unwrap_or_default())?;
    // Checked before downloading so a refused folder costs nothing.
    let folder_id = state.db.with(|c| folder_for_import(c, &dir))?;
    let (part, format, stem) = direct::download_part(&state.http, url.trim(), &dir).await?;
    let fin = direct::finalize(&part, &dir, &stem, format)?;
    let path_str = fin.path.to_str().ok_or_else(|| AppError::Invalid("Chemin illisible".into()))?.to_string();
    let meta = fs::metadata(&fin.path)?;
    let mtime = meta.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map_or(0, |d| d.as_secs() as i64);
    let new = scan::read_track(&fin.path, &path_str, &state.covers, meta.len() as i64, mtime)?;
    let track = state.db.with(|c| {
        queries::upsert_track(c, folder_id, &new)?;
        queries::track_by_path(c, &path_str)
    })?;
    log::info!("import {} : {} (doublon : {})", url_key(url), fin.path.display(), fin.duplicate);
    Ok(ImportResult { track, duplicate: fin.duplicate })
}

/// Clears playback cache files older than a day and `.part` leftovers of interrupted downloads.
pub fn clean_cache(cache: &Path, import: &Path) {
    let day = std::time::Duration::from_secs(24 * 3600);
    for (dir, only_parts) in [(cache, false), (import, true)] {
        let Ok(entries) = fs::read_dir(dir) else { continue };
        for e in entries.flatten() {
            let path = e.path();
            let is_part = path.extension().is_some_and(|x| x == "part");
            let old = e.metadata().and_then(|m| m.modified()).ok().and_then(|t| t.elapsed().ok()).is_some_and(|age| age > day);
            if (is_part || !only_parts) && old && path.is_file() {
                let _ = fs::remove_file(&path);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use Confidence::*;

    #[test]
    fn decision_modes() {
        // Auto: a single high-confidence match plays; anything else asks.
        assert_eq!(decide(Behavior::Auto, &[High]), Decision::Play);
        assert_eq!(decide(Behavior::Auto, &[Medium]), Decision::Confirm);
        assert_eq!(decide(Behavior::Auto, &[Low]), Decision::Confirm);
        assert_eq!(decide(Behavior::Auto, &[High, Low]), Decision::Confirm, "several matches = ambiguous");
        // Always confirm: never plays on its own.
        assert_eq!(decide(Behavior::AlwaysConfirm, &[High]), Decision::Confirm);
        // Instant: plays the best match whatever its confidence.
        assert_eq!(decide(Behavior::Instant, &[Low, Low]), Decision::Play);
        // Nothing to play: every mode shows the card.
        for b in [Behavior::Auto, Behavior::AlwaysConfirm, Behavior::Instant] {
            assert_eq!(decide(b, &[]), Decision::Confirm);
        }
    }

    #[test]
    fn behavior_setting_roundtrip_and_default() {
        let db = Db::open_in_memory().unwrap();
        assert_eq!(behavior(&db).unwrap(), Behavior::Auto, "default");
        for b in [Behavior::AlwaysConfirm, Behavior::Instant, Behavior::Auto] {
            set_behavior(&db, b).unwrap();
            assert_eq!(behavior(&db).unwrap(), b);
        }
        db.set_setting(BEHAVIOR_KEY, "nimporte").unwrap();
        assert_eq!(behavior(&db).unwrap(), Behavior::Auto, "unknown value falls back");
        assert_eq!(serde_json::to_string(&Behavior::AlwaysConfirm).unwrap(), "\"always_confirm\"");
        assert_eq!(serde_json::from_str::<Behavior>("\"instant\"").unwrap(), Behavior::Instant);
    }

    #[test]
    fn classifies_sources() {
        let service = |u: &str| match classify(u).unwrap() {
            Classified::Service(i) => i.provider,
            Classified::Web => "web",
        };
        assert_eq!(service("https://youtu.be/dQw4w9WgXcQ"), "youtube");
        assert_eq!(service("spotify:track:4uLU6hMCjMI75M1A2tKUQC"), "spotify");
        assert_eq!(service("https://www.deezer.com/fr/track/3135556"), "deezer");
        assert_eq!(service("https://cdn.example.com/a/titre.flac"), "web");
        assert_eq!(service("http://192.168.1.2/stream"), "web");
        assert!(classify("ftp://example.com/a.mp3").is_err());
        assert!(classify(&format!("https://e.com/{}", "a".repeat(3000))).is_err());
        let info = |u: &str| match classify(u).unwrap() {
            Classified::Service(i) => canonical(&i),
            Classified::Web => None,
        };
        assert_eq!(info("https://youtu.be/dQw4w9WgXcQ").as_deref(), Some("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
        assert_eq!(info("spotify:album:1DFixLWuPkv3KT3TnV35m3").as_deref(), Some("https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3"));
    }

    #[test]
    fn import_folder_rules() {
        let db = Db::open_in_memory().unwrap();
        db.with(|c| {
            queries::insert_folder(c, r"C:\Musique\Rap")?;
            // Inside a library folder: owned by it.
            assert_eq!(folder_for_import(c, Path::new(r"C:\Musique\Rap\Imports"))?, 1);
            // Containing a library folder: refused.
            assert!(folder_for_import(c, Path::new(r"C:\Musique")).is_err());
            // Elsewhere: added as a new library folder, once.
            let id = folder_for_import(c, Path::new(r"D:\KORZ Music"))?;
            assert_eq!(folder_for_import(c, Path::new(r"D:\KORZ Music"))?, id);
            assert_eq!(queries::folders(c)?.len(), 2);
            Ok(())
        })
        .unwrap();
    }
}
