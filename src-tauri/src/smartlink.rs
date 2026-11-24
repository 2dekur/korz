//! KORZ SMART LINK — recognises music links offline. It never fetches the page:
//! resolving metadata needs each provider's official API (KORZ CONNECT, later).

use serde::Serialize;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkInfo {
    pub provider: &'static str,
    /// track | album | playlist | artist | video | short (needs an online lookup)
    pub kind: &'static str,
    pub id: Option<String>,
}

pub fn parse(input: &str) -> AppResult<LinkInfo> {
    let input = input.trim();
    if let Some(rest) = input.strip_prefix("spotify:") {
        let mut parts = rest.split(':');
        if let (Some(kind), Some(id)) = (parts.next(), parts.next()) {
            if let Some(kind) = media_kind(kind) {
                return Ok(info("spotify", kind, Some(id)));
            }
        }
        return Err(unknown());
    }

    let without_scheme = input
        .strip_prefix("https://")
        .or_else(|| input.strip_prefix("http://"))
        .ok_or_else(unknown)?;
    let (host_path, query) = without_scheme.split_once('?').unwrap_or((without_scheme, ""));
    let (host, path) = host_path.split_once('/').unwrap_or((host_path, ""));
    let host = host.to_ascii_lowercase();
    let host = host.strip_prefix("www.").unwrap_or(&host);
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    let param = |name: &str| {
        query
            .split('&')
            .find_map(|kv| kv.split_once('=').filter(|(k, _)| *k == name).map(|(_, v)| v.to_string()))
    };

    match host {
        "open.spotify.com" => {
            // Optional locale segment: /intl-fr/track/<id>
            let segs: Vec<&str> = segments.iter().copied().skip_while(|s| s.starts_with("intl-")).collect();
            match (segs.first().and_then(|k| media_kind(k)), segs.get(1)) {
                (Some(kind), Some(id)) => Ok(info("spotify", kind, Some(id))),
                _ => Err(unknown()),
            }
        }
        "youtube.com" | "m.youtube.com" | "music.youtube.com" => match segments.first() {
            Some(&"watch") => param("v").map(|v| info("youtube", "video", Some(&v))).ok_or_else(unknown),
            Some(&"playlist") => param("list").map(|l| info("youtube", "playlist", Some(&l))).ok_or_else(unknown),
            _ => Err(unknown()),
        },
        "youtu.be" => segments.first().map(|id| info("youtube", "video", Some(id))).ok_or_else(unknown),
        "deezer.com" => {
            // Optional language segment: /fr/track/<id>
            let segs: Vec<&str> = segments.iter().copied().skip_while(|s| s.len() == 2).collect();
            match (segs.first().and_then(|k| media_kind(k)), segs.get(1)) {
                (Some(kind), Some(id)) => Ok(info("deezer", kind, Some(id))),
                _ => Err(unknown()),
            }
        }
        "link.deezer.com" | "deezer.page.link" => Ok(info("deezer", "short", None)),
        "music.apple.com" => {
            // /<country>/<kind>/<slug>/<id>?i=<trackId>
            let kind = segments.get(1).and_then(|k| if *k == "song" { Some("track") } else { media_kind(k) });
            match (kind, segments.last()) {
                (Some("album"), Some(_)) if param("i").is_some() => Ok(info("apple-music", "track", param("i").as_deref())),
                (Some(kind), Some(id)) if segments.len() >= 3 => Ok(info("apple-music", kind, Some(id))),
                _ => Err(unknown()),
            }
        }
        "soundcloud.com" => match segments.as_slice() {
            [user, set, name] if *set == "sets" => Ok(info("soundcloud", "playlist", Some(&format!("{user}/{name}")))),
            [user, name] => Ok(info("soundcloud", "track", Some(&format!("{user}/{name}")))),
            [user] => Ok(info("soundcloud", "artist", Some(user))),
            _ => Err(unknown()),
        },
        _ => Err(unknown()),
    }
}

fn media_kind(s: &str) -> Option<&'static str> {
    match s {
        "track" => Some("track"),
        "album" => Some("album"),
        "playlist" => Some("playlist"),
        "artist" => Some("artist"),
        _ => None,
    }
}

fn info(provider: &'static str, kind: &'static str, id: Option<&str>) -> LinkInfo {
    LinkInfo { provider, kind, id: id.filter(|s| !s.is_empty()).map(str::to_string) }
}

fn unknown() -> AppError {
    AppError::Invalid("Lien non reconnu (Spotify, YouTube, Deezer, Apple Music ou SoundCloud attendus)".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ok(url: &str) -> (String, String, Option<String>) {
        let i = parse(url).unwrap();
        (i.provider.into(), i.kind.into(), i.id)
    }

    #[test]
    fn recognises_providers() {
        let id = |s: &str| Some(s.to_string());
        assert_eq!(ok("https://open.spotify.com/intl-fr/track/4uLU6hMCjMI75M1A2tKUQC?si=x"), ("spotify".into(), "track".into(), id("4uLU6hMCjMI75M1A2tKUQC")));
        assert_eq!(ok("spotify:album:1DFixLWuPkv3KT3TnV35m3"), ("spotify".into(), "album".into(), id("1DFixLWuPkv3KT3TnV35m3")));
        assert_eq!(ok("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1"), ("youtube".into(), "video".into(), id("dQw4w9WgXcQ")));
        assert_eq!(ok("https://youtu.be/dQw4w9WgXcQ"), ("youtube".into(), "video".into(), id("dQw4w9WgXcQ")));
        assert_eq!(ok("https://music.youtube.com/playlist?list=PL123"), ("youtube".into(), "playlist".into(), id("PL123")));
        assert_eq!(ok("https://www.deezer.com/fr/track/3135556"), ("deezer".into(), "track".into(), id("3135556")));
        assert_eq!(ok("https://link.deezer.com/s/abc"), ("deezer".into(), "short".into(), None));
        assert_eq!(ok("https://music.apple.com/fr/album/discovery/697194953?i=697195462"), ("apple-music".into(), "track".into(), id("697195462")));
        assert_eq!(ok("https://music.apple.com/fr/album/discovery/697194953"), ("apple-music".into(), "album".into(), id("697194953")));
        assert_eq!(ok("https://soundcloud.com/artist/song-name"), ("soundcloud".into(), "track".into(), id("artist/song-name")));
    }

    #[test]
    fn rejects_unknown() {
        assert!(parse("bonjour").is_err());
        assert!(parse("https://example.com/track/1").is_err());
        assert!(parse("https://open.spotify.com/").is_err());
        assert!(parse("https://www.youtube.com/watch").is_err());
    }
}
