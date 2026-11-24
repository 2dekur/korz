//! Direct audio links: validation before and during download, `.part` file, atomic rename,
//! duplicate detection. Pages, images, video players and unknown formats are refused.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

use reqwest::header::{CONTENT_DISPOSITION, CONTENT_RANGE, CONTENT_TYPE, RANGE};
use sha2::{Digest, Sha256};

use super::matching::Confidence;
use crate::error::{AppError, AppResult};

/// Larger files are refused: a music file, not a disk filler.
pub const MAX_BYTES: u64 = 500 * 1024 * 1024;
const MAX_NAME: usize = 120;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AudioFormat {
    Mp3,
    Flac,
    Wav,
    Ogg,
    M4a,
    Aac,
}

impl AudioFormat {
    pub fn ext(self) -> &'static str {
        match self {
            AudioFormat::Mp3 => "mp3",
            AudioFormat::Flac => "flac",
            AudioFormat::Wav => "wav",
            AudioFormat::Ogg => "ogg",
            AudioFormat::M4a => "m4a",
            AudioFormat::Aac => "aac",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            AudioFormat::Mp3 => "MP3",
            AudioFormat::Flac => "FLAC",
            AudioFormat::Wav => "WAV",
            AudioFormat::Ogg => "OGG",
            AudioFormat::M4a => "M4A",
            AudioFormat::Aac => "AAC",
        }
    }
}

/// Identifies a supported format from the first bytes of the file (≥ 12 bytes needed).
pub fn sniff(head: &[u8]) -> Option<AudioFormat> {
    match head {
        [b'I', b'D', b'3', ..] => Some(AudioFormat::Mp3),
        [b'f', b'L', b'a', b'C', ..] => Some(AudioFormat::Flac),
        [b'O', b'g', b'g', b'S', ..] => Some(AudioFormat::Ogg),
        [b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'A', b'V', b'E', ..] => Some(AudioFormat::Wav),
        [_, _, _, _, b'f', b't', b'y', b'p', ..] => Some(AudioFormat::M4a),
        // MPEG frame sync: layer bits 00 = AAC (ADTS), otherwise MPEG audio (MP3).
        [0xFF, b, ..] if b & 0xF6 == 0xF0 => Some(AudioFormat::Aac),
        [0xFF, b, ..] if b & 0xE0 == 0xE0 => Some(AudioFormat::Mp3),
        _ => None,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TypeCheck {
    /// The server says it is audio.
    Audio,
    /// The server does not say (binary download): the content decides.
    Generic,
}

/// Rejects what is clearly not an audio file before reading the body.
pub fn check_content_type(content_type: Option<&str>) -> AppResult<TypeCheck> {
    let Some(ct) = content_type else { return Ok(TypeCheck::Generic) };
    let mime = ct.split(';').next().unwrap_or("").trim().to_ascii_lowercase();
    match mime.as_str() {
        m if m.starts_with("audio/") => Ok(TypeCheck::Audio),
        "application/ogg" => Ok(TypeCheck::Audio),
        "" | "application/octet-stream" | "binary/octet-stream" | "application/x-download" | "application/force-download" | "application/download" => {
            Ok(TypeCheck::Generic)
        }
        m if m.starts_with("text/") || m.contains("html") || m.contains("json") || m.contains("xml") => {
            Err(AppError::Invalid("Ce lien ouvre une page web, pas un fichier audio".into()))
        }
        m => Err(AppError::Invalid(format!("Type de contenu non audio ({m})"))),
    }
}

pub fn confidence(check: TypeCheck) -> Confidence {
    match check {
        TypeCheck::Audio => Confidence::High,
        TypeCheck::Generic => Confidence::Medium,
    }
}

/// Safe file name stem for Windows: no path separators, reserved characters or names.
pub fn sanitize_stem(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|c| if c.is_control() || "<>:\"/\\|?*".contains(c) { ' ' } else { c })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let cleaned = cleaned.trim_matches(|c| c == '.' || c == ' ');
    let mut stem: String = cleaned.chars().take(MAX_NAME).collect();
    let reserved = ["con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "lpt1", "lpt2", "lpt3"];
    if stem.is_empty() || reserved.contains(&stem.to_ascii_lowercase().as_str()) {
        stem = format!("Import {stem}").trim().to_string();
    }
    stem
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        let hex = (bytes[i] == b'%' && i + 2 < bytes.len()).then(|| std::str::from_utf8(&bytes[i + 1..i + 3]).ok()).flatten();
        match hex.and_then(|h| u8::from_str_radix(h, 16).ok()) {
            Some(b) => {
                out.push(b);
                i += 3;
            }
            None => {
                out.push(bytes[i]);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// File name stem from `Content-Disposition` (RFC 6266: `filename*=UTF-8''…` preferred, as headers
/// are ASCII), else from the last URL path segment.
pub fn name_from(url: &str, content_disposition: Option<&str>) -> String {
    let from_header = content_disposition.and_then(|cd| {
        let params = || cd.split(';').map(str::trim);
        let extended = params().find_map(|p| p.strip_prefix("filename*=")).map(|v| {
            let encoded = v.trim_matches('"');
            percent_decode(encoded.split_once("''").map_or(encoded, |(_, rest)| rest))
        });
        extended.or_else(|| params().find_map(|p| p.strip_prefix("filename=")).map(|v| v.trim_matches('"').to_string()))
    });
    let from_url = || {
        let path = url.split(['?', '#']).next().unwrap_or("");
        let after_host = path.split_once("://").map_or(path, |(_, r)| r);
        after_host.split_once('/').map(|(_, p)| p).unwrap_or("").rsplit('/').find(|s| !s.is_empty()).map(percent_decode)
    };
    let name = from_header.or_else(from_url).unwrap_or_default();
    let stem = match name.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() && ext.len() <= 5 => stem.to_string(),
        _ => name,
    };
    sanitize_stem(&stem)
}

pub struct Probe {
    pub format: AudioFormat,
    pub check: TypeCheck,
    pub size: Option<u64>,
    pub stem: String,
}

async fn open(client: &reqwest::Client, url: &str, head_only: bool) -> AppResult<(reqwest::Response, TypeCheck)> {
    let mut req = client.get(url);
    if head_only {
        req = req.header(RANGE, "bytes=0-63");
    }
    let resp = req.send().await.map_err(|e| AppError::Invalid(format!("Lien injoignable ({})", e.without_url())))?;
    if !resp.status().is_success() {
        return Err(AppError::Invalid(format!("Le serveur a répondu {}", resp.status())));
    }
    let check = check_content_type(resp.headers().get(CONTENT_TYPE).and_then(|v| v.to_str().ok()))?;
    Ok((resp, check))
}

fn total_size(resp: &reqwest::Response) -> Option<u64> {
    let range_total = resp.headers().get(CONTENT_RANGE).and_then(|v| v.to_str().ok()).and_then(|v| v.rsplit('/').next()).and_then(|t| t.parse().ok());
    range_total.or_else(|| (resp.status() == reqwest::StatusCode::OK).then(|| resp.content_length()).flatten())
}

/// Reads only the headers and the first bytes: enough to accept or refuse the link.
pub async fn probe(client: &reqwest::Client, url: &str) -> AppResult<Probe> {
    let (mut resp, check) = open(client, url, true).await?;
    let size = total_size(&resp);
    if size.is_some_and(|s| s > MAX_BYTES) {
        return Err(AppError::Invalid("Fichier trop volumineux (500 Mo maximum)".into()));
    }
    let stem = name_from(resp.url().as_str(), resp.headers().get(CONTENT_DISPOSITION).and_then(|v| v.to_str().ok()));
    let mut head = Vec::with_capacity(64);
    while head.len() < 12 {
        match resp.chunk().await.map_err(|e| AppError::Invalid(format!("Lecture interrompue ({})", e.without_url())))? {
            Some(chunk) => head.extend_from_slice(&chunk),
            None => break,
        }
    }
    let format = sniff(&head).ok_or_else(|| AppError::Invalid("Ce lien ne pointe pas vers un fichier audio pris en charge".into()))?;
    Ok(Probe { format, check, size, stem })
}

/// Streams the file into `<dir>/<stem>.<random>.part`, checking the format on the first bytes and
/// the size limit on the way. The `.part` file is removed on any failure.
/// Returns the `.part` path, the detected format and a file name stem from the server.
pub async fn download_part(client: &reqwest::Client, url: &str, dir: &Path) -> AppResult<(PathBuf, AudioFormat, String)> {
    fs::create_dir_all(dir)?;
    let (mut resp, _) = open(client, url, false).await?;
    let stem = name_from(resp.url().as_str(), resp.headers().get(CONTENT_DISPOSITION).and_then(|v| v.to_str().ok()));
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_nanos());
    let part = dir.join(format!("{stem}.{nanos}.part"));
    let result = async {
        let mut file = File::create(&part)?;
        let mut written: u64 = 0;
        let mut head = Vec::with_capacity(16);
        let mut format = None;
        while let Some(chunk) = resp.chunk().await.map_err(|e| AppError::Invalid(format!("Téléchargement interrompu ({})", e.without_url())))? {
            if format.is_none() {
                let take = (16 - head.len()).min(chunk.len());
                head.extend_from_slice(&chunk[..take]);
                if head.len() >= 12 {
                    format = Some(sniff(&head).ok_or_else(|| AppError::Invalid("Le contenu téléchargé n'est pas un fichier audio pris en charge".into()))?);
                }
            }
            written += chunk.len() as u64;
            if written > MAX_BYTES {
                return Err(AppError::Invalid("Fichier trop volumineux (500 Mo maximum)".into()));
            }
            file.write_all(&chunk)?;
        }
        file.sync_all()?;
        match format {
            Some(f) => Ok(f),
            None => sniff(&head).ok_or_else(|| AppError::Invalid("Fichier vide ou non audio".into())),
        }
    }
    .await;
    match result {
        Ok(format) => Ok((part, format, stem)),
        Err(e) => {
            let _ = fs::remove_file(&part);
            Err(e)
        }
    }
}

pub fn file_hash(path: &Path) -> std::io::Result<[u8; 32]> {
    let mut f = File::open(path)?;
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(h.finalize().into())
}

#[derive(Debug, PartialEq, Eq)]
pub struct Finalized {
    pub path: PathBuf,
    /// An identical file was already in the folder: the download was discarded.
    pub duplicate: bool,
}

/// Moves a completed `.part` into `dir` under `<stem>.<ext>` (or `<stem> (2).<ext>` …) with an atomic
/// rename in the same folder. An identical existing file (same size and SHA-256) is reused instead.
pub fn finalize(part: &Path, dir: &Path, stem: &str, format: AudioFormat) -> AppResult<Finalized> {
    let size = fs::metadata(part)?.len();
    let hash = file_hash(part)?;
    for entry in fs::read_dir(dir)?.flatten() {
        let path = entry.path();
        let same_size = entry.metadata().map(|m| m.is_file() && m.len() == size).unwrap_or(false);
        if path != part && path.extension().is_some_and(|e| e != "part") && same_size && file_hash(&path).is_ok_and(|h| h == hash) {
            fs::remove_file(part)?;
            return Ok(Finalized { path, duplicate: true });
        }
    }
    let mut n = 1;
    loop {
        let name = if n == 1 { format!("{stem}.{}", format.ext()) } else { format!("{stem} ({n}).{}", format.ext()) };
        let target = dir.join(name);
        if !target.exists() {
            fs::rename(part, &target)?;
            return Ok(Finalized { path: target, duplicate: false });
        }
        n += 1;
    }
}

pub fn client() -> AppResult<reqwest::Client> {
    // reqwest is built with rustls without a default crypto provider (shared with the updater).
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        let _ = rustls::crypto::ring::default_provider().install_default();
    }
    reqwest::Client::builder()
        .user_agent(concat!("KORZ-Music/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(10))
        .read_timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Invalid(format!("client HTTP : {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sniffs_supported_formats() {
        let cases: [(&[u8], Option<AudioFormat>); 8] = [
            (b"ID3\x04\0\0\0\0\0\0\0\0", Some(AudioFormat::Mp3)),
            (&[0xFF, 0xFB, 0x90, 0x64, 0, 0, 0, 0, 0, 0, 0, 0], Some(AudioFormat::Mp3)),
            (&[0xFF, 0xF1, 0x50, 0x80, 0, 0, 0, 0, 0, 0, 0, 0], Some(AudioFormat::Aac)),
            (b"fLaC\0\0\0\x22\0\0\0\0", Some(AudioFormat::Flac)),
            (b"RIFF\x24\0\0\0WAVEfmt ", Some(AudioFormat::Wav)),
            (b"OggS\0\x02\0\0\0\0\0\0", Some(AudioFormat::Ogg)),
            (b"\0\0\0\x20ftypM4A ", Some(AudioFormat::M4a)),
            (b"<!DOCTYPE html>", None),
        ];
        for (bytes, expected) in cases {
            assert_eq!(sniff(bytes), expected, "{bytes:?}");
        }
        assert_eq!(sniff(b"RIFF\x24\0\0\0AVI LIST"), None, "AVI is RIFF but not audio");
    }

    #[test]
    fn content_type_rules() {
        assert_eq!(check_content_type(Some("audio/mpeg")).unwrap(), TypeCheck::Audio);
        assert_eq!(check_content_type(Some("audio/flac; charset=binary")).unwrap(), TypeCheck::Audio);
        assert_eq!(check_content_type(Some("application/ogg")).unwrap(), TypeCheck::Audio);
        assert_eq!(check_content_type(Some("application/octet-stream")).unwrap(), TypeCheck::Generic);
        assert_eq!(check_content_type(None).unwrap(), TypeCheck::Generic);
        for bad in ["text/html; charset=utf-8", "application/json", "image/jpeg", "video/webm", "application/xhtml+xml"] {
            assert!(check_content_type(Some(bad)).is_err(), "{bad}");
        }
        assert_eq!(confidence(TypeCheck::Audio), Confidence::High);
        assert_eq!(confidence(TypeCheck::Generic), Confidence::Medium);
    }

    #[test]
    fn names_are_safe() {
        assert_eq!(name_from("https://ex.com/music/Mon%20Titre.flac?token=1", None), "Mon Titre");
        assert_eq!(name_from("https://ex.com/dl?id=4", Some("attachment; filename=\"Ete 85.mp3\"")), "Ete 85");
        assert_eq!(
            name_from("https://ex.com/dl?id=4", Some("attachment; filename=\"Ete 85.mp3\"; filename*=UTF-8''%C3%89t%C3%A9%2085.mp3")),
            "Été 85",
            "RFC 6266 extended name wins"
        );
        assert_eq!(name_from("https://ex.com/a/..%2F..%2Fwin.ini", None), "win");
        assert_eq!(sanitize_stem("  ../a:b*c?  "), "a b c");
        assert_eq!(sanitize_stem("CON"), "Import CON");
        assert_eq!(name_from("https://ex.com/", None), "Import");
    }

    fn temp_dir(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("korz-direct-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn finalize_renames_atomically_and_skips_duplicates() {
        let dir = temp_dir("finalize");
        let write_part = |name: &str, body: &[u8]| {
            let p = dir.join(name);
            fs::write(&p, body).unwrap();
            p
        };
        let a = finalize(&write_part("x.1.part", b"ID3 first"), &dir, "Titre", AudioFormat::Mp3).unwrap();
        assert_eq!(a, Finalized { path: dir.join("Titre.mp3"), duplicate: false });
        // Same bytes again: no second copy, the existing file is reported.
        let b = finalize(&write_part("x.2.part", b"ID3 first"), &dir, "Autre nom", AudioFormat::Mp3).unwrap();
        assert_eq!(b, Finalized { path: dir.join("Titre.mp3"), duplicate: true });
        // Same name, different bytes: kept side by side.
        let c = finalize(&write_part("x.3.part", b"ID3 second"), &dir, "Titre", AudioFormat::Mp3).unwrap();
        assert_eq!(c.path, dir.join("Titre (2).mp3"));
        let mut names: Vec<String> = fs::read_dir(&dir).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
        names.sort();
        assert_eq!(names, ["Titre (2).mp3", "Titre.mp3"], "no .part left behind");
        fs::remove_dir_all(&dir).unwrap();
    }
}
