//! Full-length playback: Deezer metadata in, matching YouTube Music audio out.
//!
//! Hybrid engine:
//! - Search + match run locally with `rustypipe` (YouTube Music Innertube, no third-party server, ~0.3-0.9 s).
//!   If YouTube Music is unreachable, an Invidious video search is the fallback.
//! - Audio bytes come through an Invidious relay: YouTube refuses direct stream access past the first chunk
//!   without a Botguard PO token, which Korz deliberately does not generate.
//! - Playback: the webview loads `korzstream://localhost/<videoId>`; this module forwards byte ranges with the
//!   headers the relay expects, so audio starts after the first small chunk.

use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use rustypipe::client::RustyPipe;
use rustypipe::model::TrackType;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::http::{Request, Response};
use tauri_plugin_http::reqwest;

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
/// A relay slower than this is skipped for the next one.
const INSTANCE_TIMEOUT: Duration = Duration::from_secs(5);
/// Relays tried per request before giving up.
const MAX_ATTEMPTS: usize = 4;
const RANGE_TIMEOUT: Duration = Duration::from_secs(20);
/// The first audio bytes must arrive this fast from a relay, otherwise the next relay is tried at once.
const FIRST_BYTE_TIMEOUT: Duration = Duration::from_millis(1500);
pub const DURATION_TOLERANCE: i64 = 4;
/// First chunk is small so playback starts fast; later chunks are larger to limit round trips.
const FIRST_CHUNK: u64 = 128 * 1024;
const NEXT_CHUNK: u64 = 1024 * 1024;
const HEAD_CACHE_SIZE: usize = 8;

const INVIDIOUS_SEEDS: &[&str] = &[
    "https://yt.chocolatemoo53.com",
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://invidious.tiekoetter.com",
];

// ---- Matching (pure, unit-tested) ---------------------------------------------------------

#[derive(Debug, Clone)]
pub struct Candidate {
    pub id: String,
    pub title: String,
    pub uploader: String,
    pub duration: i64,
    /// Official YouTube Music audio track (not a music video upload).
    pub official_song: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveRequest {
    pub artist: String,
    pub title: String,
    /// Official Deezer duration, seconds.
    pub duration: i64,
    /// What the user typed, so asked-for variants ("live", "remix") are allowed.
    pub query: Option<String>,
    /// Known match from an earlier session: skips the search.
    pub video_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Resolved {
    pub video_id: String,
    pub title: String,
    pub uploader: String,
    pub duration: i64,
}

/// Variants never played unless the request itself contains the word.
const BLOCKED: &[&str] = &[
    "remix", "slowed", "reverb", "nightcore", "8d", "karaoke", "cover", "live", "clip", "sped up",
    "instrumental", "acapella", "a cappella",
];

fn fold(c: char) -> &'static str {
    match c {
        'à' | 'á' | 'â' | 'ä' | 'ã' | 'å' => "a",
        'é' | 'è' | 'ê' | 'ë' => "e",
        'í' | 'ì' | 'î' | 'ï' => "i",
        'ó' | 'ò' | 'ô' | 'ö' | 'õ' => "o",
        'ú' | 'ù' | 'û' | 'ü' => "u",
        'ç' => "c",
        'ñ' => "n",
        'ÿ' => "y",
        'œ' => "oe",
        'æ' => "ae",
        _ => "",
    }
}

/// Lowercase, accent-free, alphanumeric words separated by single spaces.
pub fn normalize(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.to_lowercase().chars() {
        let f = fold(c);
        if !f.is_empty() {
            out.push_str(f);
        } else if c.is_alphanumeric() {
            out.push(c);
        } else {
            out.push(' ');
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Title without "(feat. …)", "[…]" or " - suffix".
pub fn base_title(title: &str) -> &str {
    let cut = [title.find('('), title.find('['), title.find(" - ")].into_iter().flatten().min();
    title[..cut.unwrap_or(title.len())].trim()
}

fn has_word(haystack: &str, word: &str) -> bool {
    format!(" {haystack} ").contains(&format!(" {word} "))
}

/// `None` = rejected. Higher is better.
pub fn score(c: &Candidate, req: &ResolveRequest) -> Option<i64> {
    let diff = (c.duration - req.duration).abs();
    if diff > DURATION_TOLERANCE {
        return None;
    }
    let wanted = normalize(&format!("{} {} {}", req.artist, req.title, req.query.as_deref().unwrap_or("")));
    let cand_title = normalize(&c.title);
    let cand = format!("{cand_title} {}", normalize(&c.uploader));
    if BLOCKED.iter().any(|w| has_word(&cand, w) && !has_word(&wanted, w)) {
        return None;
    }

    // At least 70 % of the title words must be present.
    let base = normalize(base_title(&req.title));
    let words: Vec<&str> = base.split(' ').filter(|w| !w.is_empty()).collect();
    let hits = words.iter().filter(|w| has_word(&cand_title, w)).count();
    if words.is_empty() || hits * 10 < words.len() * 7 {
        return None;
    }

    // The main artist must appear in the uploader or the title: no re-uploads of a namesake song.
    let main_artist = normalize(req.artist.split(|ch| ch == ',' || ch == '&').next().unwrap_or(""));
    if main_artist.is_empty() || !cand.contains(&main_artist) {
        return None;
    }

    let topic = c.uploader.ends_with(" - Topic");
    let mut s = 100 - 5 * diff;
    if c.official_song || topic {
        s += 60;
    }
    if normalize(&c.uploader).contains(&main_artist) {
        s += 40;
    }
    if cand_title == base {
        s += 20;
    }
    Some(s)
}

pub fn best<'a>(cands: &'a [Candidate], req: &ResolveRequest) -> Option<&'a Candidate> {
    cands
        .iter()
        .filter_map(|c| score(c, req).map(|s| (s, c)))
        .max_by_key(|(s, _)| *s)
        .map(|(_, c)| c)
}

/// `bytes=START-[END]` → (start, end). Anything else means "from the beginning".
pub fn parse_range(h: Option<&str>) -> (u64, Option<u64>) {
    let Some(spec) = h.and_then(|h| h.strip_prefix("bytes=")) else { return (0, None) };
    let mut it = spec.splitn(2, '-');
    let start = it.next().and_then(|s| s.trim().parse().ok()).unwrap_or(0);
    let end = it.next().and_then(|s| s.trim().parse().ok());
    (start, end)
}

/// Total size from an upstream `Content-Range: bytes a-b/TOTAL`.
pub fn range_total(content_range: &str) -> Option<u64> {
    content_range.rsplit('/').next()?.trim().parse().ok()
}

// ---- Relay pool ---------------------------------------------------------------------------

/// Relays sorted by moving-average latency; a failure counts as a 60 s response.
struct Pool(Mutex<Vec<(String, f64)>>);

impl Pool {
    fn new(seeds: &[&str]) -> Self {
        Self(Mutex::new(seeds.iter().enumerate().map(|(i, s)| (s.to_string(), 1000.0 + i as f64)).collect()))
    }
    fn ordered(&self) -> Vec<String> {
        let mut v = self.0.lock().unwrap().clone();
        v.sort_by(|a, b| a.1.total_cmp(&b.1));
        v.into_iter().map(|(u, _)| u).take(MAX_ATTEMPTS).collect()
    }
    fn record(&self, url: &str, ms: Option<f64>) {
        let sample = ms.unwrap_or(60_000.0);
        if let Some(e) = self.0.lock().unwrap().iter_mut().find(|(u, _)| u == url) {
            e.1 = e.1 * 0.6 + sample * 0.4;
        }
    }
    fn add(&self, urls: impl IntoIterator<Item = String>) {
        let mut v = self.0.lock().unwrap();
        for u in urls {
            let u = u.trim_end_matches('/').to_string();
            if u.starts_with("https://") && !v.iter().any(|(x, _)| *x == u) {
                v.push((u, 5000.0));
            }
        }
    }
}

// ---- Service ------------------------------------------------------------------------------

#[derive(Clone)]
struct Format {
    url: String,
    mime: String,
    /// Relay base URL; also sent as Referer, which relays require.
    relay: String,
    expires: u64,
}

struct Head {
    id: String,
    bytes: Vec<u8>,
    size: u64,
    mime: String,
}

pub struct Streams {
    rp: RustyPipe,
    http: reqwest::Client,
    relays: Pool,
    formats: Mutex<HashMap<String, Format>>,
    heads: Mutex<VecDeque<Head>>,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn valid_id(id: &str) -> bool {
    id.len() == 11 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

impl Streams {
    /// `storage` keeps rustypipe's client data (versions, cache) between launches; `None` = in memory only.
    pub fn new(storage: Option<PathBuf>) -> Self {
        // Never run Botguard challenge solvers.
        let mut builder = RustyPipe::builder().no_botguard();
        builder = match storage.filter(|d| std::fs::create_dir_all(d).is_ok()) {
            Some(dir) => builder.storage_dir(dir),
            None => builder.no_storage(),
        };
        Self {
            rp: builder.build().expect("rustypipe client"),
            http: reqwest::Client::builder().user_agent(UA).build().expect("http client"),
            relays: Pool::new(INVIDIOUS_SEEDS),
            formats: Mutex::new(HashMap::new()),
            heads: Mutex::new(VecDeque::new()),
        }
    }

    /// Adds relays from the public Invidious directory; on failure the seeds remain.
    pub async fn discover(&self) {
        if let Ok(list) = self.json("https://api.invidious.io/instances.json?sort_by=health").await {
            let urls = list.as_array().into_iter().flatten().filter_map(|e| {
                let info = e.get(1)?;
                let usable = info.get("api")?.as_bool()? && info.get("type")?.as_str()? == "https";
                usable.then(|| info.get("uri")?.as_str().map(String::from)).flatten()
            });
            self.relays.add(urls.collect::<Vec<_>>());
        }
    }

    async fn json(&self, url: &str) -> Result<Value, String> {
        let res = self.http.get(url).timeout(INSTANCE_TIMEOUT).send().await.map_err(err)?;
        if !res.status().is_success() {
            return Err(format!("HTTP {}", res.status()));
        }
        serde_json::from_slice(&res.bytes().await.map_err(err)?).map_err(err)
    }

    /// GET `path` on the fastest relay, moving to the next one on error or timeout.
    async fn relay_json(&self, path: &str) -> Result<(String, Value), String> {
        let mut last = String::from("aucun relais disponible");
        for inst in self.relays.ordered() {
            let t = Instant::now();
            match self.json(&format!("{inst}{path}")).await {
                Ok(v) if v.get("error").is_none() => {
                    self.relays.record(&inst, Some(t.elapsed().as_millis() as f64));
                    return Ok((inst, v));
                }
                Ok(v) => last = v["error"].to_string(),
                Err(e) => last = e,
            }
            self.relays.record(&inst, None);
        }
        Err(last)
    }

    /// Local YouTube Music search (no third-party server).
    async fn music_search(&self, q: &str, videos: bool) -> Result<Vec<Candidate>, String> {
        let query = self.rp.query();
        let found = if videos { query.music_search_videos(q).await } else { query.music_search_tracks(q).await };
        Ok(found
            .map_err(err)?
            .items
            .items
            .into_iter()
            .filter_map(|t| {
                Some(Candidate {
                    duration: i64::from(t.duration?),
                    uploader: t.artists.iter().map(|a| a.name.as_str()).collect::<Vec<_>>().join(", "),
                    official_song: t.track_type == TrackType::Track,
                    id: t.id,
                    title: t.name,
                })
            })
            .collect())
    }

    /// Fallback when YouTube Music cannot be reached directly.
    async fn relay_search(&self, q: &str) -> Result<Vec<Candidate>, String> {
        let url = reqwest::Url::parse_with_params("https://x/api/v1/search", [("q", q), ("type", "video")]).map_err(err)?;
        let (_, v) = self.relay_json(&format!("/api/v1/search?{}", url.query().unwrap_or_default())).await?;
        Ok(v.as_array()
            .into_iter()
            .flatten()
            .filter_map(|i| {
                Some(Candidate {
                    id: i["videoId"].as_str()?.to_string(),
                    title: i["title"].as_str()?.to_string(),
                    uploader: i["author"].as_str().unwrap_or_default().to_string(),
                    duration: i["lengthSeconds"].as_i64()?,
                    official_song: false,
                })
            })
            .collect())
    }

    pub async fn resolve(&self, req: &ResolveRequest) -> Result<Resolved, String> {
        if let Some(id) = req.video_id.as_deref().filter(|id| valid_id(id)) {
            return Ok(Resolved { video_id: id.into(), title: req.title.clone(), uploader: req.artist.clone(), duration: req.duration });
        }
        let main_artist = req.artist.split(',').next().unwrap_or(&req.artist).trim();
        let q = format!("{main_artist} {}", base_title(&req.title));
        let found = |c: &Candidate| Resolved { video_id: c.id.clone(), title: c.title.clone(), uploader: c.uploader.clone(), duration: c.duration };

        // Official tracks first, then music videos (their audio often differs), then the relay search.
        let mut errors = Vec::new();
        for videos in [false, true] {
            match self.music_search(&q, videos).await {
                Ok(cands) => {
                    if let Some(c) = best(&cands, req) {
                        return Ok(found(c));
                    }
                }
                Err(e) => errors.push(e),
            }
        }
        if !errors.is_empty() {
            if let Some(c) = self.relay_search(&q).await.ok().as_deref().and_then(|cands| best(cands, req)) {
                return Ok(found(c));
            }
            return Err(format!("YouTube Music injoignable ({})", errors.join(" ; ")));
        }
        Err("Aucune version officielle à la bonne durée".into())
    }

    async fn format(&self, id: &str, refresh: bool) -> Result<Format, String> {
        if !refresh {
            if let Some(f) = self.formats.lock().unwrap().get(id).filter(|f| f.expires > now() + 60) {
                return Ok(f.clone());
            }
        }
        let (inst, v) = self.relay_json(&format!("/api/v1/videos/{id}?local=true")).await?;
        let audio = v["adaptiveFormats"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|f| f["type"].as_str().is_some_and(|t| t.starts_with("audio/")))
            .max_by_key(|f| f["bitrate"].as_u64().or_else(|| f["bitrate"].as_str()?.parse().ok()).unwrap_or(0))
            .ok_or("Aucun flux audio pour ce titre")?;
        let raw = audio["url"].as_str().ok_or("URL de flux manquante")?;
        let url = if raw.starts_with('/') { format!("{inst}{raw}") } else { raw.to_string() };
        let expires = url.split(['?', '&']).find_map(|p| p.strip_prefix("expire=")?.parse().ok()).unwrap_or(now() + 3600);
        let f = Format { url, mime: audio["type"].as_str().unwrap_or("audio/mp4").into(), relay: inst, expires };
        self.formats.lock().unwrap().insert(id.into(), f.clone());
        Ok(f)
    }

    /// Returns (status, body, total size, mime). A relay that errors, refuses, or (for the first chunk) takes
    /// longer than `FIRST_BYTE_TIMEOUT` is demoted and the next relay is tried immediately.
    async fn fetch_range(&self, id: &str, start: u64, end: u64) -> Result<(u16, Vec<u8>, u64, String), String> {
        let mut last = String::from("aucun relais disponible");
        for attempt in 0..MAX_ATTEMPTS {
            // Strict deadline on the first try only: with a single live relay, a slow answer still beats the preview.
            let timeout = if start == 0 && attempt == 0 { FIRST_BYTE_TIMEOUT } else { RANGE_TIMEOUT };
            // Retries always take a fresh URL, from whichever relay now ranks first.
            let f = self.format(id, attempt > 0).await?;
            let t = Instant::now();
            let sent = self
                .http
                .get(&f.url)
                .header("Range", format!("bytes={start}-{end}"))
                .header("Referer", format!("{}/", f.relay))
                .timeout(timeout)
                .send()
                .await;
            let res = match sent {
                Ok(r) => r,
                Err(e) => {
                    self.relays.record(&f.relay, None);
                    last = err(e);
                    continue;
                }
            };
            let status = res.status().as_u16();
            if matches!(status, 403 | 410 | 429) || status >= 500 {
                self.relays.record(&f.relay, None);
                last = format!("HTTP {status}");
                continue;
            }
            let total = res.headers().get("content-range").and_then(|v| v.to_str().ok()).and_then(range_total).unwrap_or(0);
            let body = match res.bytes().await {
                Ok(b) => b.to_vec(),
                Err(e) => {
                    self.relays.record(&f.relay, None);
                    last = err(e);
                    continue;
                }
            };
            self.relays.record(&f.relay, Some(t.elapsed().as_millis() as f64));
            return Ok((status, body, total, f.mime));
        }
        Err(format!("Flux indisponible ({last})"))
    }

    /// Warms format + first chunk so the track starts without a network round trip.
    pub async fn prefetch(&self, id: &str) -> Result<(), String> {
        if self.heads.lock().unwrap().iter().any(|h| h.id == id) {
            return Ok(());
        }
        let (status, bytes, size, mime) = self.fetch_range(id, 0, FIRST_CHUNK - 1).await?;
        if status == 206 && size > 0 {
            let mut heads = self.heads.lock().unwrap();
            heads.push_back(Head { id: id.into(), bytes, size, mime });
            while heads.len() > HEAD_CACHE_SIZE {
                heads.pop_front();
            }
        }
        Ok(())
    }

    /// `korzstream://localhost/<videoId>` handler: answers the webview's byte-range requests.
    pub async fn serve(&self, req: Request<Vec<u8>>) -> Response<Vec<u8>> {
        let id = req.uri().path().trim_matches('/').to_string();
        if !valid_id(&id) {
            return plain(400, "identifiant invalide");
        }
        let (start, end) = parse_range(req.headers().get("range").and_then(|v| v.to_str().ok()));
        let end = end.unwrap_or(start + if start == 0 { FIRST_CHUNK } else { NEXT_CHUNK } - 1);

        if start == 0 && end < FIRST_CHUNK {
            if let Some(h) = self.heads.lock().unwrap().iter().find(|h| h.id == id) {
                return partial(h.bytes.clone(), 0, h.size, &h.mime);
            }
        }
        match self.fetch_range(&id, start, end).await {
            Ok((206, body, size, mime)) if size > 0 && !body.is_empty() => partial(body, start, size, &mime),
            Ok((status, body, _, mime)) => Response::builder()
                .status(status)
                .header("Content-Type", mime)
                .body(body)
                .unwrap_or_else(|_| plain(502, "")),
            Err(e) => plain(502, &e),
        }
    }
}

/// 206 with a Content-Range built from the bytes actually returned. Some relays echo the requested end even
/// past EOF; Chromium rejects that (MEDIA_ERR while probing WebM cues), so the upstream header is not reused.
fn partial(body: Vec<u8>, start: u64, size: u64, mime: &str) -> Response<Vec<u8>> {
    let end = start + body.len() as u64 - 1;
    Response::builder()
        .status(206)
        .header("Content-Type", mime)
        .header("Content-Range", format!("bytes {start}-{end}/{size}"))
        .header("Accept-Ranges", "bytes")
        .header("Content-Length", body.len())
        .header("Access-Control-Allow-Origin", "*")
        .body(body)
        .unwrap_or_else(|_| plain(500, ""))
}

fn plain(status: u16, msg: &str) -> Response<Vec<u8>> {
    Response::builder().status(status).body(msg.as_bytes().to_vec()).expect("static response")
}

// ---- Lyrics (YouTube Music, local via rustypipe) -----------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YtmLyrics {
    pub body: String,
    /// Attribution shown by YouTube Music ("Source: …").
    pub footer: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricHit {
    pub video_id: String,
    pub title: String,
    pub artists: Vec<String>,
    pub duration: i64,
}

impl Streams {
    pub async fn lyrics(&self, video_id: &str) -> Result<Option<YtmLyrics>, String> {
        if !valid_id(video_id) {
            return Err("identifiant invalide".into());
        }
        let details = self.rp.query().music_details(video_id).await.map_err(err)?;
        let Some(lyrics_id) = details.lyrics_id else { return Ok(None) };
        // A lyrics id without lyrics behind it is reported as an error: treat it as "no lyrics".
        Ok(self.rp.query().music_lyrics(&lyrics_id).await.ok().map(|l| YtmLyrics { body: l.body, footer: l.footer }))
    }

    /// YouTube Music search also matches lyric phrases: official tracks only.
    pub async fn lyric_search(&self, q: &str) -> Result<Vec<LyricHit>, String> {
        let found = self.rp.query().music_search_tracks(q).await.map_err(err)?;
        Ok(found
            .items
            .items
            .into_iter()
            .filter(|t| t.track_type == TrackType::Track)
            .filter_map(|t| {
                Some(LyricHit {
                    duration: i64::from(t.duration?),
                    artists: t.artists.into_iter().map(|a| a.name).collect(),
                    video_id: t.id,
                    title: t.name,
                })
            })
            .take(5)
            .collect())
    }
}

// ---- Tauri commands -----------------------------------------------------------------------

#[tauri::command]
pub async fn ytm_lyrics(state: tauri::State<'_, Arc<Streams>>, video_id: String) -> Result<Option<YtmLyrics>, String> {
    state.lyrics(&video_id).await
}

#[tauri::command]
pub async fn lyrics_search(state: tauri::State<'_, Arc<Streams>>, q: String) -> Result<Vec<LyricHit>, String> {
    if q.trim().len() < 8 || q.len() > 300 {
        return Ok(Vec::new());
    }
    state.lyric_search(q.trim()).await
}

#[tauri::command]
pub async fn resolve_stream(state: tauri::State<'_, Arc<Streams>>, req: ResolveRequest) -> Result<Resolved, String> {
    let resolved = state.resolve(&req).await?;
    // Warm the stream URL so the first range request does not pay for it.
    let s = state.inner().clone();
    let id = resolved.video_id.clone();
    tauri::async_runtime::spawn(async move {
        let _ = s.format(&id, false).await;
    });
    Ok(resolved)
}

#[tauri::command]
pub async fn prefetch_stream(state: tauri::State<'_, Arc<Streams>>, req: ResolveRequest) -> Result<Resolved, String> {
    let resolved = state.resolve(&req).await?;
    state.prefetch(&resolved.video_id).await?;
    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req(artist: &str, title: &str, duration: i64) -> ResolveRequest {
        ResolveRequest { artist: artist.into(), title: title.into(), duration, query: None, video_id: None }
    }
    fn cand(id: &str, title: &str, uploader: &str, duration: i64, song: bool) -> Candidate {
        Candidate { id: id.into(), title: title.into(), uploader: uploader.into(), duration, official_song: song }
    }

    #[test]
    fn picks_official_song_within_tolerance() {
        let r = req("Werenoi", "Solitaire", 146);
        let c = [
            cand("clip0000000", "Werenoi - Solitaire (Clip Officiel)", "Werenoi", 150, false),
            cand("remix000000", "Solitaire (Remix)", "Werenoi", 146, true),
            cand("song0000000", "Solitaire", "Werenoi", 147, true),
            cand("far00000000", "Solitaire", "Werenoi", 160, true),
        ];
        assert_eq!(best(&c, &r).map(|c| c.id.as_str()), Some("song0000000"));
    }

    #[test]
    fn duration_tolerance_is_four_seconds() {
        let r = req("Avie", "Bina", 135);
        assert!(score(&cand("a0000000000", "Bina", "AVIE, Delil", 139, true), &r).is_some());
        assert!(score(&cand("a0000000000", "Bina", "AVIE, Delil", 140, true), &r).is_none());
    }

    #[test]
    fn blocked_words_allowed_when_requested() {
        let live = cand("l0000000000", "Live Forever", "Oasis", 276, true);
        assert!(score(&live, &req("Oasis", "Live Forever", 276)).is_some());
        let concert = cand("c0000000000", "Wonderwall (Live)", "Oasis", 260, true);
        assert!(score(&concert, &req("Oasis", "Wonderwall", 259)).is_none());
        let mut asked = req("Oasis", "Wonderwall", 259);
        asked.query = Some("wonderwall live".into());
        assert!(score(&concert, &asked).is_some());
    }

    #[test]
    fn rejects_namesake_by_other_artist() {
        assert!(score(&cand("x0000000000", "Solitaire", "Someone Else", 146, true), &req("Werenoi", "Solitaire", 146)).is_none());
    }

    #[test]
    fn helpers() {
        assert_eq!(normalize("Pétunias (feat. X) — Été"), "petunias feat x ete");
        assert_eq!(base_title("Get Lucky (feat. Pharrell)"), "Get Lucky");
        assert_eq!(parse_range(Some("bytes=100-")), (100, None));
        assert_eq!(parse_range(Some("bytes=0-99")), (0, Some(99)));
        assert_eq!(parse_range(None), (0, None));
        assert_eq!(range_total("bytes 2359296-3407871/2889263"), Some(2889263));
    }

    #[test]
    fn failing_relay_is_demoted_behind_healthy_ones() {
        let pool = Pool::new(&["https://a", "https://b", "https://c"]);
        assert_eq!(pool.ordered()[0], "https://a");
        pool.record("https://a", None); // timeout / 403 / error
        pool.record("https://b", Some(300.0));
        assert_eq!(pool.ordered(), ["https://b", "https://c", "https://a"]);
    }

    #[test]
    fn content_range_never_past_eof() {
        let r = partial(vec![0; 10], 90, 100, "audio/webm");
        assert_eq!(r.headers()["content-range"], "bytes 90-99/100");
    }

    async fn deezer(artist: &str, title: &str) -> ResolveRequest {
        let url = reqwest::Url::parse_with_params("https://api.deezer.com/search", &[("q", format!("{artist} {title}")), ("limit", "1".into())]).unwrap();
        let v: Value = serde_json::from_slice(&reqwest::get(url).await.unwrap().bytes().await.unwrap()).unwrap();
        let t = &v["data"][0];
        ResolveRequest {
            artist: t["artist"]["name"].as_str().unwrap().into(),
            title: t["title"].as_str().unwrap().into(),
            duration: t["duration"].as_i64().unwrap(),
            query: None,
            video_id: None,
        }
    }

    /// End to end against live services: Deezer → local YouTube Music match → relay audio bytes.
    /// `cargo test live_ -- --ignored --nocapture --test-threads=1`
    #[tokio::test]
    #[ignore]
    async fn live_full_stream_for_real_artists() {
        let s = Streams::new(None);
        for (artist, title) in [("Werenoi", "Solitaire"), ("Avie", "Bina"), ("Avie", "LUNA&MONICA"), ("Werenoi", "Chemin d'or")] {
            let r = deezer(artist, title).await;
            let t0 = Instant::now();
            let res = s.resolve(&r).await.unwrap_or_else(|e| panic!("{artist} - {title}: {e}"));
            let t_resolve = t0.elapsed();
            assert!((res.duration - r.duration).abs() <= DURATION_TOLERANCE);
            let (status, bytes, size, mime) = s.fetch_range(&res.video_id, 0, FIRST_CHUNK - 1).await.expect("range");
            println!(
                "{} - {} ({}s) -> {} \"{}\" by {} ({}s) | resolve {t_resolve:?}, first chunk at {:?} | {status} {mime} {} B of {size}",
                r.artist, r.title, r.duration, res.video_id, res.title, res.uploader, res.duration, t0.elapsed(), bytes.len()
            );
            assert_eq!(status, 206);
        }
    }

    /// Whole file through `serve`, as the webview requests it, plus a cue probe near the end.
    #[tokio::test]
    #[ignore]
    async fn live_serve_whole_file() {
        let s = Streams::new(None);
        let res = s.resolve(&deezer("Avie", "LUNA&MONICA").await).await.expect("resolve");
        let (mut next, mut size, mut got) = (0u64, u64::MAX, 0u64);
        let get = |range: String| {
            let req = Request::builder().uri(format!("korzstream://localhost/{}", res.video_id)).header("range", range).body(Vec::new()).unwrap();
            s.serve(req)
        };
        while next < size {
            let resp = get(if next == 0 { "bytes=0-".into() } else { format!("bytes={next}-") }).await;
            assert_eq!(resp.status(), 206, "{}", String::from_utf8_lossy(resp.body()));
            let cr = resp.headers()["content-range"].to_str().unwrap().to_string();
            size = range_total(&cr).unwrap();
            got += resp.body().len() as u64;
            next += resp.body().len() as u64;
        }
        assert_eq!(got, size, "every byte of the full track was served");
        let probe = get(format!("bytes={}-", size - 4096)).await;
        assert_eq!(probe.headers()["content-range"], format!("bytes {}-{}/{size}", size - 4096, size - 1));
        println!("{} \"{}\": {size} bytes served in full", res.video_id, res.title);
    }
    /// Match + first-byte check for every track of a Deezer album: `KORZ_ALBUM=<deezer id>` (default: Diamant Noir).
    #[tokio::test]
    #[ignore]
    async fn live_album_coverage() {
        let s = Streams::new(None);
        let album = std::env::var("KORZ_ALBUM").unwrap_or_else(|_| "dz-search:Werenoi Diamant Noir".into());
        let id = if let Some(q) = album.strip_prefix("dz-search:") {
            let url = reqwest::Url::parse_with_params("https://api.deezer.com/search/album", &[("q", q)]).unwrap();
            let v: Value = serde_json::from_slice(&reqwest::get(url).await.unwrap().bytes().await.unwrap()).unwrap();
            v["data"][0]["id"].to_string()
        } else {
            album
        };
        let v: Value = serde_json::from_slice(&reqwest::get(format!("https://api.deezer.com/album/{id}/tracks?limit=100")).await.unwrap().bytes().await.unwrap()).unwrap();
        let (mut ok, mut total) = (0, 0);
        for t in v["data"].as_array().unwrap() {
            total += 1;
            let r = ResolveRequest {
                artist: t["artist"]["name"].as_str().unwrap().into(),
                title: t["title"].as_str().unwrap().into(),
                duration: t["duration"].as_i64().unwrap(),
                query: None,
                video_id: None,
            };
            let t0 = Instant::now();
            match s.resolve(&r).await {
                Ok(res) => match s.fetch_range(&res.video_id, 0, FIRST_CHUNK - 1).await {
                    Ok((206, ..)) => {
                        ok += 1;
                        println!("OK   {} ({}s) -> {} ({}s) in {:?}", r.title, r.duration, res.video_id, res.duration, t0.elapsed());
                    }
                    other => println!("FLUX {} -> {}: {:?}", r.title, res.video_id, other.map(|o| o.0)),
                },
                Err(e) => println!("MISS {} ({}s): {e}", r.title, r.duration),
            }
        }
        println!("{ok}/{total} titres en version complète");
    }
    /// YouTube Music lyrics + lyric-phrase search. `cargo test live_lyrics -- --ignored --nocapture`
    #[tokio::test]
    #[ignore]
    async fn live_lyrics() {
        let s = Streams::new(None);
        let l = s.lyrics("UOA02IFSqic").await.expect("lyrics call").expect("Werenoi - Solitaire has lyrics");
        println!("Solitaire: {} lines | {}", l.body.lines().count(), l.footer);
        assert!(l.body.lines().count() > 10);
        let hits = s.lyric_search("j'suis dans la merde j'ai répondu à mon ex").await.expect("search");
        println!("phrase -> {:?}", hits.iter().map(|h| format!("{} — {}", h.title, h.artists.join(", "))).collect::<Vec<_>>());
        assert!(hits.iter().any(|h| h.title == "Jalouse"));
    }
}
