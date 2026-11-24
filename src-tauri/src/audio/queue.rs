//! Play queue logic, independent from audio output so it can be unit-tested.

use crate::library::models::Track;

#[derive(Debug, Default, Clone)]
pub struct Queue {
    pub tracks: Vec<Track>,
    pub index: Option<usize>,
}

impl Queue {
    pub fn current(&self) -> Option<&Track> {
        self.index.and_then(|i| self.tracks.get(i))
    }

    /// Replaces the queue; `start` is clamped. Returns the track to play.
    pub fn replace(&mut self, tracks: Vec<Track>, start: usize) -> Option<&Track> {
        self.index = if tracks.is_empty() { None } else { Some(start.min(tracks.len() - 1)) };
        self.tracks = tracks;
        self.current()
    }

    pub fn append(&mut self, tracks: Vec<Track>) {
        self.tracks.extend(tracks);
    }

    pub fn jump(&mut self, index: usize) -> Option<&Track> {
        if index >= self.tracks.len() {
            return None;
        }
        self.index = Some(index);
        self.current()
    }

    /// Advances; at the end of the queue the index stays on the last track and None is returned.
    pub fn next(&mut self) -> Option<&Track> {
        let next = self.index.map_or(0, |i| i + 1);
        if next >= self.tracks.len() {
            return None;
        }
        self.index = Some(next);
        self.current()
    }

    pub fn previous(&mut self) -> Option<&Track> {
        let prev = self.index?.checked_sub(1)?;
        self.index = Some(prev);
        self.current()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t(id: i64) -> Track {
        Track {
            id,
            path: String::new(),
            title: format!("t{id}"),
            artist: String::new(),
            album: String::new(),
            album_artist: String::new(),
            genre: None,
            track_no: None,
            disc_no: None,
            year: None,
            duration_ms: 0,
            format: String::new(),
            cover: None,
            favorite: false,
        }
    }

    #[test]
    fn navigation() {
        let mut q = Queue::default();
        assert!(q.next().is_none());
        assert_eq!(q.replace(vec![t(1), t(2), t(3)], 9).map(|t| t.id), Some(3), "start is clamped");
        assert!(q.next().is_none());
        assert_eq!(q.index, Some(2), "end of queue keeps the last track");
        assert_eq!(q.previous().map(|t| t.id), Some(2));
        assert_eq!(q.previous().map(|t| t.id), Some(1));
        assert!(q.previous().is_none());
        q.append(vec![t(4)]);
        assert_eq!(q.jump(3).map(|t| t.id), Some(4));
        assert!(q.jump(4).is_none());
        assert!(q.replace(vec![], 0).is_none());
        assert_eq!(q.index, None);
    }
}
