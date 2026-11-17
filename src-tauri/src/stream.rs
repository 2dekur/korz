//! Full-length playback: Deezer metadata in, matching YouTube Music audio out.
//!
//! - Search: Piped `music_songs` (official YouTube Music tracks), Invidious video search as fallback.
//! - Match: strict filter (no remix/live/cover/…, unless asked) + official duration ±4 s.
//! - Playback: the webview loads `korzstream://localhost/<videoId>`; this module proxies byte ranges from an
//!   Invidious instance (which needs browser-like headers the webview cannot set), so audio starts after the
//!   first small chunk instead of after a full download.

use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::http::{Request, Response};
use tauri_plugin_http::reqwest;

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
/// An instance slower than this is skipped for the next one.
const INSTANCE_TIMEOUT: Duration = Duration::from_secs(5);
/// Instances tried per request before giving up.
const MAX_ATTEMPTS: usize = 4;
pub const DURATION_TOLERANCE: i64 = 4;
/// First chunk is small so playback starts fast; later chunks are larger to limit round trips.
const FIRST_CHUNK: u64 = 256 * 1024;
const NEXT_CHUNK: u64 = 1024 * 1024;
const HEAD_CACHE_SIZE: usize = 6;

const PIPED_SEEDS: &[&str] = &[
    "https://api.piped.private.coffee",
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
    "https://pipedapi.leptons.xyz",
];
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
    /// Came from YouTube Music's "songs" shelf (official audio, not a video upload).
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

// ---- Instance pool ------------------------------------------------------------------------

/// Instances sorted by moving-average latency; a failure counts as a 60 s response.
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
    referer: String,
    expires: u64,
}

struct Head {
    id: String,
    bytes: Vec<u8>,
    content_range: String,
    mime: String,
}

pub struct Streams {
    client: reqwest::Client,
    piped: Pool,
    invidious: Pool,
    formats: Mutex<HashMap<String, Format>>,
    heads: Mutex<VecDeque<Head>>,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn valid_id(id: &str) -> bool {
    id.len() == 11 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

impl Streams {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder().user_agent(UA).build().expect("http client"),
            piped: Pool::new(PIPED_SEEDS),
            invidious: Pool::new(INVIDIOUS_SEEDS),
            formats: Mutex::new(HashMap::new()),
            heads: Mutex::new(VecDeque::new()),
        }
    }

    /// Adds instances from the public directories; failures are ignored (seeds remain).
    pub async fn discover(&self) {
        if let Ok(list) = self.json("https://api.invidious.io/instances.json?sort_by=health").await {
            let urls = list.as_array().into_iter().flatten().filter_map(|e| {
                let info = e.get(1)?;
                let usable = info.get("api")?.as_bool()? && info.get("type")?.as_str()? == "https";
                usable.then(|| info.get("uri")?.as_str().map(String::from)).flatten()
            });
            self.invidious.add(urls.collect::<Vec<_>>());
        }
        if let Ok(list) = self.json("https://piped-instances.kavin.rocks/").await {
            let urls = list.as_array().into_iter().flatten().filter_map(|e| e.get("api_url")?.as_str().map(String::from));
            self.piped.add(urls.collect::<Vec<_>>());
        }
    }

    async fn json(&self, url: &str) -> Result<Value, String> {
        let res = self.client.get(url).timeout(INSTANCE_TIMEOUT).send().await.map_err(|e| e.to_string())?;
        if !res.status().is_success() {
            return Err(format!("HTTP {}", res.status()));
        }
        let body = res.bytes().await.map_err(|e| e.to_string())?;
        serde_json::from_slice(&body).map_err(|e| e.to_string())
    }

    /// GET `path` on the fastest instance of `pool`, moving to the next one on error or timeout.
    async fn pool_json(&self, pool: &Pool, path: &str) -> Result<(String, Value), String> {
        let mut last = String::from("aucune instance disponible");
        for inst in pool.ordered() {
            let t = Instant::now();
            match self.json(&format!("{inst}{path}")).await {
                Ok(v) if v.get("error").is_none() => {
                    pool.record(&inst, Some(t.elapsed().as_millis() as f64));
                    return Ok((inst, v));
                }
                Ok(v) => last = v["error"].to_string(),
                Err(e) => last = e,
            }
            pool.record(&inst, None);
        }
        Err(last)
    }

    async fn piped_search(&self, q: &str) -> Result<Vec<Candidate>, String> {
        let path = format!("/search?q={}&filter=music_songs", urlencode(q));
        let (_, v) = self.pool_json(&self.piped, &path).await?;
        Ok(v["items"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|i| {
                Some(Candidate {
                    id: i["url"].as_str()?.split("v=").nth(1)?.to_string(),
                    title: i["title"].as_str()?.to_string(),
                    uploader: i["uploaderName"].as_str().unwrap_or_default().to_string(),
                    duration: i["duration"].as_i64()?,
                    official_song: true,
                })
            })
            .collect())
    }

    async fn invidious_search(&self, q: &str) -> Result<Vec<Candidate>, String> {
        let path = format!("/api/v1/search?q={}&type=video", urlencode(q));
        let (_, v) = self.pool_json(&self.invidious, &path).await?;
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

        let mut errors = Vec::new();
        for songs in [true, false] {
            let found = if songs { self.piped_search(&q).await } else { self.invidious_search(&q).await };
            match found {
                Ok(cands) => {
                    if let Some(c) = best(&cands, req) {
                        return Ok(Resolved { video_id: c.id.clone(), title: c.title.clone(), uploader: c.uploader.clone(), duration: c.duration });
                    }
                }
                Err(e) => errors.push(e),
            }
        }
        Err(if errors.len() == 2 {
            format!("Serveurs de flux injoignables ({})", errors.join(" ; "))
        } else {
            "Aucune version officielle à la bonne durée".into()
        })
    }

    async fn format(&self, id: &str, refresh: bool) -> Result<Format, String> {
        if !refresh {
            if let Some(f) = self.formats.lock().unwrap().get(id).filter(|f| f.expires > now() + 60) {
                return Ok(f.clone());
            }
        }
        let (inst, v) = self.pool_json(&self.invidious, &format!("/api/v1/videos/{id}?local=true")).await?;
        let audio = v["adaptiveFormats"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|f| f["type"].as_str().is_some_and(|t| t.starts_with("audio/")))
            .max_by_key(|f| f["bitrate"].as_u64().or_else(|| f["bitrate"].as_str()?.parse().ok()).unwrap_or(0))
            .ok_or("Aucun flux audio pour cette vidéo")?;
        let raw = audio["url"].as_str().ok_or("URL de flux manquante")?;
        let url = if raw.starts_with('/') { format!("{inst}{raw}") } else { raw.to_string() };
        let expires = url.split(['?', '&']).find_map(|p| p.strip_prefix("expire=")?.parse().ok()).unwrap_or(now() + 3600);
        let f = Format { url, mime: audio["type"].as_str().unwrap_or("audio/mp4").into(), referer: format!("{inst}/"), expires };
        self.formats.lock().unwrap().insert(id.into(), f.clone());
        Ok(f)
    }

    async fn fetch_range(&self, id: &str, start: u64, end: u64) -> Result<(u16, Vec<u8>, String, String), String> {
        for refresh in [false, true] {
            let f = self.format(id, refresh).await?;
            let res = self
                .client
                .get(&f.url)
                .header("Range", format!("bytes={start}-{end}"))
                .header("Referer", &f.referer)
                .timeout(Duration::from_secs(15))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let status = res.status().as_u16();
            // Signed URLs expire or get pinned to another instance: refetch the format once.
            if matches!(status, 403 | 410) && !refresh {
                continue;
            }
            let upstream = res.headers().get("content-range").and_then(|v| v.to_str().ok()).unwrap_or_default().to_string();
            let body = res.bytes().await.map_err(|e| e.to_string())?.to_vec();
            // Some instances echo the requested end even past EOF; Chromium rejects that (MEDIA_ERR on WebM
            // cue probing), so the header is rebuilt from the bytes actually received.
            let range = match upstream.rsplit('/').next().and_then(|t| t.parse::<u64>().ok()) {
                Some(total) if !body.is_empty() => format!("bytes {start}-{}/{total}", start + body.len() as u64 - 1),
                _ => upstream,
            };
            return Ok((status, body, range, f.mime));
        }
        Err("Flux refusé par le serveur".into())
    }

    /// Warms format + first chunk so the next track starts without a network round trip.
    pub async fn prefetch(&self, id: &str) -> Result<(), String> {
        if self.heads.lock().unwrap().iter().any(|h| h.id == id) {
            return Ok(());
        }
        let (status, bytes, content_range, mime) = self.fetch_range(id, 0, FIRST_CHUNK - 1).await?;
        if status == 206 {
            let mut heads = self.heads.lock().unwrap();
            heads.push_back(Head { id: id.into(), bytes, content_range, mime });
            while heads.len() > HEAD_CACHE_SIZE {
                heads.pop_front();
            }
        }
        Ok(())
    }

    /// `korzstream://localhost/<videoId>` handler: forwards byte ranges with the headers the instance expects.
    pub async fn serve(&self, req: Request<Vec<u8>>) -> Response<Vec<u8>> {
        let id = req.uri().path().trim_matches('/').to_string();
        if !valid_id(&id) {
            return plain(400, "identifiant invalide");
        }
        let (start, end) = parse_range(req.headers().get("range").and_then(|v| v.to_str().ok()));
        let end = end.unwrap_or(start + if start == 0 { FIRST_CHUNK } else { NEXT_CHUNK } - 1);

        if start == 0 && end < FIRST_CHUNK {
            if let Some(h) = self.heads.lock().unwrap().iter().find(|h| h.id == id) {
                return partial(h.bytes.clone(), &h.content_range, &h.mime);
            }
        }
        match self.fetch_range(&id, start, end).await {
            Ok((206, body, range, mime)) => partial(body, &range, &mime),
            Ok((status, body, _, mime)) => Response::builder()
                .status(status)
                .header("Content-Type", mime)
                .body(body)
                .unwrap_or_else(|_| plain(502, "")),
            Err(e) => plain(502, &e),
        }
    }
}

fn partial(body: Vec<u8>, content_range: &str, mime: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(206)
        .header("Content-Type", mime)
        .header("Content-Range", content_range)
        .header("Accept-Ranges", "bytes")
        .header("Content-Length", body.len())
        .header("Access-Control-Allow-Origin", "*")
        .body(body)
        .unwrap_or_else(|_| plain(500, ""))
}

fn plain(status: u16, msg: &str) -> Response<Vec<u8>> {
    Response::builder().status(status).body(msg.as_bytes().to_vec()).expect("static response")
}

/// `bytes=START-[END]` → (start, end). Anything else means "from the beginning".
pub fn parse_range(h: Option<&str>) -> (u64, Option<u64>) {
    let Some(spec) = h.and_then(|h| h.strip_prefix("bytes=")) else { return (0, None) };
    let mut it = spec.splitn(2, '-');
    let start = it.next().and_then(|s| s.trim().parse().ok()).unwrap_or(0);
    let end = it.next().and_then(|s| s.trim().parse().ok());
    (start, end)
}

fn urlencode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

// ---- Tauri commands -----------------------------------------------------------------------

#[tauri::command]
pub async fn resolve_stream(state: tauri::State<'_, Arc<Streams>>, req: ResolveRequest) -> Result<Resolved, String> {
    let resolved = state.resolve(&req).await?;
    // Warm the format URL so the first range request does not pay for it.
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
        assert!(score(&cand("a0000000000", "Bina", "AVIE & Delil", 139, true), &r).is_some());
        assert!(score(&cand("a0000000000", "Bina", "AVIE & Delil", 140, true), &r).is_none());
    }

    #[test]
    fn blocked_words_allowed_when_requested() {
        let live = cand("l0000000000", "Live Forever", "Oasis - Topic", 276, false);
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
    }

    /// End to end against live services: Deezer metadata → resolve → first audio bytes.
    /// `cargo test live_ -- --ignored --nocapture`
    #[tokio::test]
    #[ignore]
    async fn live_full_stream_for_real_artists() {
        let s = Streams::new();
        for (artist, title) in [("Werenoi", "Solitaire"), ("Avie", "Bina"), ("Werenoi", "Chemin d'or")] {
            let q = urlencode(&format!("{artist} {title}"));
            let dz = s.json(&format!("https://api.deezer.com/search?q={q}&limit=1")).await.expect("deezer");
            let t = &dz["data"][0];
            let r = ResolveRequest {
                artist: t["artist"]["name"].as_str().unwrap().into(),
                title: t["title"].as_str().unwrap().into(),
                duration: t["duration"].as_i64().unwrap(),
                query: None,
                video_id: None,
            };
            let res = s.resolve(&r).await.unwrap_or_else(|e| panic!("{artist} - {title}: {e}"));
            assert!((res.duration - r.duration).abs() <= DURATION_TOLERANCE);
            let t0 = Instant::now();
            let (status, bytes, range, mime) = s.fetch_range(&res.video_id, 0, FIRST_CHUNK - 1).await.expect("range");
            println!(
                "{} - {} ({}s) -> {} \"{}\" by {} ({}s) | {status} {mime} {} bytes in {:?} | {range}",
                r.artist, r.title, r.duration, res.video_id, res.title, res.uploader, res.duration, bytes.len(), t0.elapsed()
            );
            assert_eq!(status, 206);
            assert!(range.contains('/'), "total size known for seeking");
        }
    }
    /// Sequential range requests as the webview issues them; prints throughput per chunk.
    /// `cargo test live_serve -- --ignored --nocapture`
    #[tokio::test]
    #[ignore]
    async fn live_serve_sequential_ranges() {
        let s = Streams::new();
        let r = ResolveRequest { artist: "Avie".into(), title: "LUNA&MONICA".into(), duration: 159, query: None, video_id: None };
        let res = s.resolve(&r).await.expect("resolve");
        println!("match {} \"{}\" by {} ({}s)", res.video_id, res.title, res.uploader, res.duration);
        let mut next = 0u64;
        for i in 0..4 {
            let range = if i == 0 { "bytes=0-".to_string() } else { format!("bytes={next}-") };
            let req = Request::builder().uri(format!("korzstream://localhost/{}", res.video_id)).header("range", &range).body(Vec::new()).unwrap();
            let t0 = Instant::now();
            let resp = s.serve(req).await;
            let cr = resp.headers().get("content-range").map(|v| v.to_str().unwrap().to_string()).unwrap_or_default();
            let len = resp.body().len();
            println!("{range} -> {} {len} B in {:?} ({:.0} KB/s) | {cr}", resp.status(), t0.elapsed(), len as f64 / 1024.0 / t0.elapsed().as_secs_f64());
            assert_eq!(resp.status(), 206, "body: {}", String::from_utf8_lossy(&resp.body()[..len.min(200)]));
            let (span, total) = cr.trim_start_matches("bytes ").split_once('/').unwrap();
            let end: u64 = span.split_once('-').unwrap().1.parse().unwrap();
            assert!(end < total.parse::<u64>().unwrap(), "Content-Range past EOF: {cr}");
            assert_eq!(end + 1 - next, len as u64, "Content-Range matches body");
            next += len as u64;
        }
    }
}
