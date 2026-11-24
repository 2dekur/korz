//! Folder scan: walks the folder, reads tags with lofty, caches embedded covers, updates SQLite.
//! Unchanged files (same size and modification time) are not re-read.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use lofty::prelude::*;
use lofty::picture::PictureType;
use sha2::{Digest, Sha256};

use super::models::{NewTrack, ScanProgress, ScanSummary};
use super::queries;
use crate::db::Db;
use crate::error::{AppError, AppResult};

/// Extensions the audio engine decodes (see Cargo.toml rodio features).
pub const AUDIO_EXTENSIONS: &[&str] = &["mp3", "flac", "wav", "aac", "m4a", "ogg", "oga"];
const BATCH: usize = 100;

/// Validates and registers a folder, then scans it.
pub fn add_folder(db: &Db, covers: &Path, raw: &str, progress: &dyn Fn(ScanProgress)) -> AppResult<ScanSummary> {
    let root = canonical_dir(raw)?;
    let root_str = root.to_str().ok_or_else(|| AppError::Invalid("Chemin de dossier illisible".into()))?.to_string();
    let id = db.with(|c| {
        for f in queries::folders(c)? {
            let existing = Path::new(&f.path);
            if root.starts_with(existing) || existing.starts_with(&root) {
                return Err(AppError::Invalid(format!("Ce dossier recoupe un dossier déjà ajouté : {}", f.path)));
            }
        }
        queries::insert_folder(c, &root_str)
    })?;
    scan_folder(db, covers, id, &root, progress)
}

pub fn rescan_all(db: &Db, covers: &Path, progress: &dyn Fn(ScanProgress)) -> AppResult<ScanSummary> {
    let mut total = ScanSummary::default();
    for f in db.with(|c| queries::folders(c))? {
        let root = PathBuf::from(&f.path);
        if !root.is_dir() {
            // Unplugged drive or moved folder: keep the library entries rather than wiping them.
            log::warn!("dossier absent, ignoré : {}", f.path);
            continue;
        }
        total.merge(&scan_folder(db, covers, f.id, &root, progress)?);
    }
    Ok(total)
}

/// Canonical, existing directory, without the `\\?\` prefix Windows adds.
pub fn canonical_dir(raw: &str) -> AppResult<PathBuf> {
    let path = fs::canonicalize(raw.trim()).map_err(|_| AppError::Invalid("Dossier introuvable".into()))?;
    if !path.is_dir() {
        return Err(AppError::Invalid("Ce chemin n'est pas un dossier".into()));
    }
    Ok(strip_verbatim(path))
}

fn strip_verbatim(path: PathBuf) -> PathBuf {
    match path.to_str().and_then(|s| s.strip_prefix(r"\\?\")) {
        // Only plain drive paths (C:\...); UNC verbatim paths keep their prefix.
        Some(rest) if rest.as_bytes().get(1) == Some(&b':') => PathBuf::from(rest),
        _ => path,
    }
}

fn scan_folder(db: &Db, covers: &Path, folder_id: i64, root: &Path, progress: &dyn Fn(ScanProgress)) -> AppResult<ScanSummary> {
    let files = audio_files(root);
    let index = db.with(|c| queries::folder_index(c, folder_id))?;
    let folder = root.display().to_string();
    let mut summary = ScanSummary::default();
    let mut seen = HashSet::with_capacity(files.len());
    let mut batch: Vec<(bool, NewTrack)> = Vec::with_capacity(BATCH);

    for (i, path) in files.iter().enumerate() {
        if i % 25 == 0 {
            progress(ScanProgress { folder: folder.clone(), done: i, total: files.len() });
        }
        let Some(path_str) = path.to_str() else {
            summary.failed += 1;
            continue;
        };
        seen.insert(path_str.to_string());
        let Ok(meta) = fs::metadata(path) else {
            summary.failed += 1;
            continue;
        };
        let size = meta.len() as i64;
        let mtime = meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map_or(0, |d| d.as_secs() as i64);
        let known = index.get(path_str);
        if matches!(known, Some(&(_, s, m)) if s == size && m == mtime) {
            summary.unchanged += 1;
            continue;
        }
        match read_track(path, path_str, covers, size, mtime) {
            Ok(t) => batch.push((known.is_some(), t)),
            Err(e) => {
                log::warn!("lecture des métadonnées impossible ({path_str}) : {e}");
                summary.failed += 1;
            }
        }
        if batch.len() >= BATCH {
            write_batch(db, folder_id, &mut batch, &mut summary)?;
        }
    }
    write_batch(db, folder_id, &mut batch, &mut summary)?;

    let gone: Vec<i64> = index.iter().filter(|(p, _)| !seen.contains(*p)).map(|(_, &(id, _, _))| id).collect();
    db.with(|c| {
        let tx = c.transaction()?;
        for id in &gone {
            queries::delete_track(&tx, *id)?;
        }
        tx.commit()?;
        Ok(())
    })?;
    summary.removed = gone.len() as u32;
    progress(ScanProgress { folder, done: files.len(), total: files.len() });
    log::info!("analyse {} : {:?}", root.display(), summary);
    Ok(summary)
}

fn write_batch(db: &Db, folder_id: i64, batch: &mut Vec<(bool, NewTrack)>, summary: &mut ScanSummary) -> AppResult<()> {
    if batch.is_empty() {
        return Ok(());
    }
    db.with(|c| {
        let tx = c.transaction()?;
        for (_, t) in batch.iter() {
            queries::upsert_track(&tx, folder_id, t)?;
        }
        tx.commit()?;
        Ok(())
    })?;
    for (known, _) in batch.drain(..) {
        if known { summary.updated += 1 } else { summary.added += 1 }
    }
    Ok(())
}

/// Every supported audio file under `root`. Symlinks are not followed (no cycles); unreadable
/// subfolders are skipped and logged.
pub fn audio_files(root: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(e) => {
                log::warn!("dossier illisible {} : {e}", dir.display());
                continue;
            }
        };
        for entry in entries.flatten() {
            let Ok(kind) = entry.file_type() else { continue };
            let path = entry.path();
            if kind.is_dir() {
                stack.push(path);
            } else if kind.is_file() && is_audio(&path) {
                out.push(path);
            }
        }
    }
    out.sort();
    out
}

fn is_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| AUDIO_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
}

fn non_empty(s: Option<std::borrow::Cow<'_, str>>) -> Option<String> {
    s.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

pub fn read_track(path: &Path, path_str: &str, covers: &Path, size: i64, mtime: i64) -> AppResult<NewTrack> {
    let file = lofty::read_from_path(path).map_err(|e| AppError::Invalid(e.to_string()))?;
    let duration_ms = file.properties().duration().as_millis() as i64;
    let tag = file.primary_tag().or_else(|| file.first_tag());
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Sans titre").to_string();
    let title = tag.and_then(|t| non_empty(t.title())).unwrap_or(stem);
    let artist = tag.and_then(|t| non_empty(t.artist())).unwrap_or_else(|| "Artiste inconnu".into());
    let album_artist = tag
        .and_then(|t| t.get_string(ItemKey::AlbumArtist))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| artist.clone());
    let cover = tag.and_then(|t| {
        let pics = t.pictures();
        let pic = pics.iter().find(|p| p.pic_type() == PictureType::CoverFront).or_else(|| pics.first())?;
        match store_cover(covers, pic.data()) {
            Ok(hash) => Some(hash),
            Err(e) => {
                log::warn!("pochette non enregistrée ({path_str}) : {e}");
                None
            }
        }
    });
    Ok(NewTrack {
        path: path_str.to_string(),
        title,
        artist,
        album: tag.and_then(|t| non_empty(t.album())).unwrap_or_else(|| "Album inconnu".into()),
        album_artist,
        genre: tag.and_then(|t| non_empty(t.genre())),
        track_no: tag.and_then(|t| t.track()),
        disc_no: tag.and_then(|t| t.disk()),
        year: tag.and_then(|t| t.date()).map(|d| i32::from(d.year)),
        duration_ms,
        format: path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase(),
        cover,
        file_size: size,
        modified_at: mtime,
    })
}

/// Writes the image once under its content hash; identical covers across an album share one file.
fn store_cover(dir: &Path, data: &[u8]) -> std::io::Result<String> {
    let digest = Sha256::digest(data);
    let hash: String = digest.iter().take(16).map(|b| format!("{b:02x}")).collect();
    let file = dir.join(&hash);
    if !file.exists() {
        fs::write(&file, data)?;
    }
    Ok(hash)
}

/// The cover protocol accepts only names produced by `store_cover` (32 lowercase hex chars),
/// so a request can never escape the covers directory.
pub fn is_cover_name(name: &str) -> bool {
    name.len() == 32 && name.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cover_names_are_strict() {
        assert!(is_cover_name("0123456789abcdef0123456789abcdef"));
        assert!(!is_cover_name("../../etc/passwd"));
        assert!(!is_cover_name("0123456789ABCDEF0123456789ABCDEF"));
        assert!(!is_cover_name("0123456789abcdef"));
    }

    #[test]
    fn strips_drive_verbatim_prefix_only() {
        assert_eq!(strip_verbatim(PathBuf::from(r"\\?\C:\Musique")), PathBuf::from(r"C:\Musique"));
        assert_eq!(strip_verbatim(PathBuf::from(r"\\?\UNC\srv\share")), PathBuf::from(r"\\?\UNC\srv\share"));
    }

    #[test]
    fn walks_only_audio_files() {
        let root = std::env::temp_dir().join(format!("korz-walk-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("sub")).unwrap();
        for f in ["a.MP3", "sub/b.flac", "c.txt", "sub/d.jpg"] {
            fs::write(root.join(f), b"x").unwrap();
        }
        let names: Vec<String> = audio_files(&root).iter().map(|p| p.file_name().unwrap().to_string_lossy().into_owned()).collect();
        assert_eq!(names, ["a.MP3", "b.flac"]);
        fs::remove_dir_all(&root).unwrap();
    }
}
