//! Scores how well a local track matches the title/artist a service reports for a link.
//! Pure functions: the same accent/case folding as the library search (`queries::fold`).

use std::collections::HashSet;

use serde::Serialize;

use crate::library::queries::fold;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Confidence {
    Low,
    Medium,
    High,
}

/// Bracketed parts made only of these words are packaging, not part of the title.
const NOISE: &[&str] = &[
    "official", "officiel", "officielle", "video", "clip", "audio", "lyrics", "lyric", "paroles", "visualizer", "visualiser", "hd", "hq", "4k",
    "music", "musique", "remastered", "remaster", "version", "live", "explicit", "mv",
];

pub fn tokens(s: &str) -> Vec<String> {
    fold(s).split(|c: char| !c.is_alphanumeric()).filter(|t| !t.is_empty()).map(str::to_string).collect()
}

/// "Artist - Title (Official Video) [4K]" → "Artist - Title".
pub fn clean_remote_title(title: &str) -> String {
    let mut out = String::with_capacity(title.len());
    let mut rest = title;
    while let Some(start) = rest.find(['(', '[']) {
        let close = if rest.as_bytes()[start] == b'(' { ')' } else { ']' };
        let Some(len) = rest[start..].find(close) else { break };
        let inner = &rest[start + 1..start + len];
        out.push_str(&rest[..start]);
        if !tokens(inner).iter().all(|t| NOISE.contains(&t.as_str()) || t.chars().all(|c| c.is_ascii_digit())) {
            out.push_str(&rest[start..=start + len]);
        }
        rest = &rest[start + len + 1..];
    }
    out.push_str(rest);
    out.trim().to_string()
}

/// YouTube channel names: "DaftPunkVEVO", "Daft Punk - Topic", "Daft Punk Official".
pub fn clean_author(author: &str) -> String {
    let mut a = author.trim().to_string();
    for suffix in [" - Topic", " - topic", "VEVO", "Vevo", " Official", " officiel", " Officiel"] {
        if let Some(stripped) = a.strip_suffix(suffix) {
            a = stripped.trim().to_string();
        }
    }
    a
}

/// What a link says about itself, already cleaned.
pub struct Query {
    words: HashSet<String>,
    /// Remote title words that are not the artist's name: what a local title must account for.
    title_words: HashSet<String>,
}

impl Query {
    pub fn new(title: &str, artist: Option<&str>) -> Self {
        let artist_words: HashSet<String> = artist.map(|a| tokens(&clean_author(a)).into_iter().collect()).unwrap_or_default();
        let title_words: HashSet<String> = tokens(&clean_remote_title(title)).into_iter().filter(|t| !artist_words.contains(t)).collect();
        let words = title_words.iter().chain(artist_words.iter()).cloned().collect();
        Self { words, title_words }
    }

    /// Longest words first: used to pre-select tracks in SQL.
    pub fn key_words(&self, n: usize) -> Vec<String> {
        let mut w: Vec<String> = self.words.iter().filter(|t| t.chars().count() >= 2).cloned().collect();
        w.sort_by(|a, b| b.chars().count().cmp(&a.chars().count()).then(a.cmp(b)));
        w.truncate(n);
        w
    }

    /// 0..1: local title fully present (45 %), remote title explained by the local track (25 %),
    /// local artist present in the link (30 %).
    pub fn score(&self, title: &str, artist: &str) -> f32 {
        let local_title: HashSet<String> = tokens(title).into_iter().collect();
        let local_artist: HashSet<String> = tokens(artist).into_iter().collect();
        if local_title.is_empty() || self.title_words.is_empty() {
            return 0.0;
        }
        let covered = local_title.iter().filter(|t| self.words.contains(*t)).count() as f32 / local_title.len() as f32;
        let explained = self.title_words.iter().filter(|t| local_title.contains(*t) || local_artist.contains(*t)).count() as f32 / self.title_words.len() as f32;
        let artist_hit = !local_artist.is_empty() && local_artist.iter().all(|t| self.words.contains(t));
        0.45 * covered + 0.25 * explained + if artist_hit { 0.30 } else { 0.0 }
    }
}

pub fn confidence(score: f32) -> Option<Confidence> {
    match score {
        s if s >= 0.9 => Some(Confidence::High),
        s if s >= 0.65 => Some(Confidence::Medium),
        s if s >= 0.45 => Some(Confidence::Low),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn conf(title: &str, author: Option<&str>, local: (&str, &str)) -> Option<Confidence> {
        confidence(Query::new(title, author).score(local.0, local.1))
    }

    #[test]
    fn cleans_packaging() {
        assert_eq!(clean_remote_title("Daft Punk - One More Time (Official Video) [4K]"), "Daft Punk - One More Time");
        assert_eq!(clean_remote_title("Song (feat. Someone) (Lyrics)"), "Song (feat. Someone)");
        assert_eq!(clean_remote_title("Unclosed (bracket"), "Unclosed (bracket");
        assert_eq!(clean_author("DaftPunkVEVO"), "DaftPunk");
        assert_eq!(clean_author("Daft Punk - Topic"), "Daft Punk");
    }

    #[test]
    fn confidence_levels() {
        let yt = "Daft Punk - One More Time (Official Video)";
        assert_eq!(conf(yt, Some("Daft Punk"), ("One More Time", "Daft Punk")), Some(Confidence::High));
        // Accents, case and ligatures are folded like the library search.
        assert_eq!(conf("CELINE DION - Pour que tu m'aimes encore", None, ("Pour que tu m’aimes encore", "Céline Dion")), Some(Confidence::High));
        // Same title, extra words on the local side: a different version.
        assert_eq!(conf(yt, Some("Daft Punk"), ("One More Time (Radio Edit)", "Daft Punk")), Some(Confidence::Medium));
        // Spotify oEmbed gives no artist: a matching title alone is not enough for "high".
        assert_eq!(conf("Néons", None, ("Néons", "Lumen")), Some(Confidence::Medium));
        // Same artist, other song.
        assert!(conf(yt, Some("Daft Punk"), ("Around the World", "Daft Punk")) < Some(Confidence::Medium));
        assert_eq!(conf(yt, Some("Daft Punk"), ("Marée", "Atlas")), None);
    }

    #[test]
    fn key_words_prefer_long_tokens() {
        let q = Query::new("Daft Punk - One More Time", None);
        assert_eq!(q.key_words(2), vec!["daft".to_string(), "more".to_string()]);
    }
}
