//! SQL reads and writes. Every function takes the connection so callers decide the transaction.

use rusqlite::{params, params_from_iter, Connection, OptionalExtension, Row, ToSql};
use unicode_normalization::char::is_combining_mark;
use unicode_normalization::UnicodeNormalization;

use super::models::*;
use crate::db::now;
use crate::error::{AppError, AppResult};

const TRACK_COLS: &str = "t.id, t.path, t.title, t.artist, t.album, t.album_artist, t.genre, t.track_no, t.disc_no, \
     t.year, t.duration_ms, t.format, t.cover, (f.track_id IS NOT NULL)";
const TRACK_FROM: &str = "FROM tracks t LEFT JOIN favorites f ON f.track_id = t.id";
const MAX_HISTORY: i64 = 5000;
const MAX_NAME: usize = 100;

fn track(r: &Row) -> rusqlite::Result<Track> {
    Ok(Track {
        id: r.get(0)?,
        path: r.get(1)?,
        title: r.get(2)?,
        artist: r.get(3)?,
        album: r.get(4)?,
        album_artist: r.get(5)?,
        genre: r.get(6)?,
        track_no: r.get(7)?,
        disc_no: r.get(8)?,
        year: r.get(9)?,
        duration_ms: r.get(10)?,
        format: r.get(11)?,
        cover: r.get(12)?,
        favorite: r.get(13)?,
    })
}

/// Lowercase without diacritics: « Été » and « ete » compare equal. Ligatures are spelled out.
pub fn fold(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.nfd().filter(|c| !is_combining_mark(*c)).flat_map(char::to_lowercase) {
        match c {
            'œ' => out.push_str("oe"),
            'æ' => out.push_str("ae"),
            'ß' => out.push_str("ss"),
            'ø' => out.push('o'),
            'ł' => out.push('l'),
            'đ' => out.push('d'),
            c => out.push(c),
        }
    }
    out
}

fn search_text(title: &str, artist: &str, album: &str, album_artist: &str) -> String {
    fold(&format!("{title} {artist} {album} {album_artist}"))
}

/// `%term%` with LIKE wildcards in the user's text escaped.
fn like(term: &str) -> String {
    let escaped = term.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
    format!("%{escaped}%")
}

pub fn tracks(c: &Connection, q: &TrackQuery) -> AppResult<Vec<Track>> {
    let mut wheres: Vec<String> = Vec::new();
    let mut args: Vec<Box<dyn ToSql>> = Vec::new();
    if let Some(search) = q.search.as_deref() {
        // Every word must appear in the folded title, artist or album.
        for word in fold(search).split_whitespace().take(8) {
            wheres.push("t.search LIKE ? ESCAPE '\\'".into());
            args.push(Box::new(like(word)));
        }
    }
    if q.favorites {
        wheres.push("f.track_id IS NOT NULL".into());
    }
    if let Some(album) = &q.album {
        wheres.push("t.album = ?".into());
        args.push(Box::new(album.clone()));
    }
    if let Some(album_artist) = &q.album_artist {
        wheres.push("t.album_artist = ?".into());
        args.push(Box::new(album_artist.clone()));
    }
    if let Some(artist) = &q.artist {
        wheres.push("(t.artist = ? OR t.album_artist = ?)".into());
        args.push(Box::new(artist.clone()));
        args.push(Box::new(artist.clone()));
    }
    let filter = if wheres.is_empty() { String::new() } else { format!("WHERE {}", wheres.join(" AND ")) };
    let order = if q.favorites {
        "f.added_at DESC"
    } else if q.album.is_some() {
        "t.disc_no, t.track_no, t.title COLLATE NOCASE"
    } else {
        "t.album_artist COLLATE NOCASE, t.year, t.album COLLATE NOCASE, t.disc_no, t.track_no"
    };
    let limit = if q.search.is_some() { "LIMIT 500" } else { "" };
    let sql = format!("SELECT {TRACK_COLS} {TRACK_FROM} {filter} ORDER BY {order} {limit}");
    let mut stmt = c.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(args.iter().map(|a| a.as_ref())), track)?;
    Ok(rows.collect::<Result<_, _>>()?)
}

/// Tracks in the given order; unknown ids are skipped.
pub fn tracks_by_ids(c: &Connection, ids: &[i64]) -> AppResult<Vec<Track>> {
    let mut stmt = c.prepare_cached(&format!("SELECT {TRACK_COLS} {TRACK_FROM} WHERE t.id = ?1"))?;
    let mut out = Vec::with_capacity(ids.len());
    for id in ids {
        if let Some(t) = stmt.query_row([id], track).optional()? {
            out.push(t);
        }
    }
    Ok(out)
}

fn album(r: &Row) -> rusqlite::Result<Album> {
    Ok(Album { title: r.get(0)?, artist: r.get(1)?, year: r.get(2)?, cover: r.get(3)?, track_count: r.get(4)?, duration_ms: r.get(5)? })
}

const ALBUM_COLS: &str = "album, album_artist, MAX(year), MAX(cover), COUNT(*), SUM(duration_ms)";

pub fn albums(c: &Connection, artist: Option<&str>) -> AppResult<Vec<Album>> {
    let rows = match artist {
        Some(a) => {
            let mut stmt = c.prepare(&format!(
                "SELECT {ALBUM_COLS} FROM tracks WHERE album_artist = ?1 GROUP BY album_artist, album ORDER BY MAX(year) DESC, album COLLATE NOCASE"
            ))?;
            stmt.query_map([a], album)?.collect::<Result<Vec<_>, _>>()?
        }
        None => {
            let mut stmt = c.prepare(&format!(
                "SELECT {ALBUM_COLS} FROM tracks GROUP BY album_artist, album ORDER BY album COLLATE NOCASE, album_artist COLLATE NOCASE"
            ))?;
            stmt.query_map([], album)?.collect::<Result<Vec<_>, _>>()?
        }
    };
    Ok(rows)
}

pub fn recent_albums(c: &Connection, limit: i64) -> AppResult<Vec<Album>> {
    let mut stmt = c.prepare(&format!("SELECT {ALBUM_COLS} FROM tracks GROUP BY album_artist, album ORDER BY MAX(added_at) DESC, MAX(id) DESC LIMIT ?1"))?;
    Ok(stmt.query_map([limit], album)?.collect::<Result<_, _>>()?)
}

pub fn artists(c: &Connection) -> AppResult<Vec<Artist>> {
    let mut stmt = c.prepare(
        "SELECT album_artist, COUNT(DISTINCT album), COUNT(*), MAX(cover) FROM tracks GROUP BY album_artist ORDER BY album_artist COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([], |r| Ok(Artist { name: r.get(0)?, album_count: r.get(1)?, track_count: r.get(2)?, cover: r.get(3)? }))?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn stats(c: &Connection) -> AppResult<LibraryStats> {
    Ok(c.query_row(
        "SELECT COUNT(*), (SELECT COUNT(*) FROM (SELECT 1 FROM tracks GROUP BY album_artist, album)), COUNT(DISTINCT album_artist), COALESCE(SUM(duration_ms), 0) FROM tracks",
        [],
        |r| Ok(LibraryStats { tracks: r.get(0)?, albums: r.get(1)?, artists: r.get(2)?, duration_ms: r.get(3)? }),
    )?)
}

// ── Folders ──────────────────────────────────────────────────────────────────

pub fn folders(c: &Connection) -> AppResult<Vec<Folder>> {
    let mut stmt = c.prepare("SELECT fo.id, fo.path, COUNT(t.id) FROM folders fo LEFT JOIN tracks t ON t.folder_id = fo.id GROUP BY fo.id ORDER BY fo.path")?;
    let rows = stmt.query_map([], |r| Ok(Folder { id: r.get(0)?, path: r.get(1)?, track_count: r.get(2)? }))?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn insert_folder(c: &Connection, path: &str) -> AppResult<i64> {
    c.execute("INSERT INTO folders (path, added_at) VALUES (?1, ?2)", params![path, now()])?;
    Ok(c.last_insert_rowid())
}

/// Removes the folder and its tracks from the library. Files on disk are not touched.
pub fn remove_folder(c: &Connection, id: i64) -> AppResult<()> {
    if c.execute("DELETE FROM folders WHERE id = ?1", [id])? == 0 {
        return Err(AppError::NotFound("dossier".into()));
    }
    Ok(())
}

/// path -> (id, size, mtime) for change detection during a rescan.
pub fn folder_index(c: &Connection, folder_id: i64) -> AppResult<std::collections::HashMap<String, (i64, i64, i64)>> {
    let mut stmt = c.prepare("SELECT path, id, file_size, modified_at FROM tracks WHERE folder_id = ?1")?;
    let rows = stmt.query_map([folder_id], |r| Ok((r.get::<_, String>(0)?, (r.get(1)?, r.get(2)?, r.get(3)?))))?;
    Ok(rows.collect::<Result<_, _>>()?)
}

/// Insert or refresh a track; the id (and so favorites, playlists, history) survives a rescan.
pub fn upsert_track(c: &Connection, folder_id: i64, t: &NewTrack) -> AppResult<()> {
    c.prepare_cached(
        "INSERT INTO tracks (folder_id, path, title, artist, album, album_artist, genre, track_no, disc_no, year, duration_ms, format, cover, file_size, modified_at, added_at, search)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
         ON CONFLICT(path) DO UPDATE SET folder_id = excluded.folder_id, title = excluded.title, artist = excluded.artist, album = excluded.album,
           album_artist = excluded.album_artist, genre = excluded.genre, track_no = excluded.track_no, disc_no = excluded.disc_no, year = excluded.year,
           duration_ms = excluded.duration_ms, format = excluded.format, cover = excluded.cover, file_size = excluded.file_size, modified_at = excluded.modified_at, search = excluded.search",
    )?
    .execute(params![
        folder_id, t.path, t.title, t.artist, t.album, t.album_artist, t.genre, t.track_no, t.disc_no, t.year, t.duration_ms, t.format, t.cover,
        t.file_size, t.modified_at, now(), search_text(&t.title, &t.artist, &t.album, &t.album_artist)
    ])?;
    Ok(())
}

/// Fills the search column of rows written before migration 2. Returns how many were updated.
pub fn backfill_search(c: &mut Connection) -> AppResult<usize> {
    let tx = c.transaction()?;
    let rows: Vec<(i64, String)> = {
        let mut stmt = tx.prepare("SELECT id, title, artist, album, album_artist FROM tracks WHERE search = ''")?;
        let mapped = stmt.query_map([], |r| {
            Ok((r.get(0)?, search_text(&r.get::<_, String>(1)?, &r.get::<_, String>(2)?, &r.get::<_, String>(3)?, &r.get::<_, String>(4)?)))
        })?;
        mapped.collect::<Result<_, _>>()?
    };
    for (id, search) in &rows {
        tx.execute("UPDATE tracks SET search = ?2 WHERE id = ?1", params![id, search])?;
    }
    tx.commit()?;
    Ok(rows.len())
}

pub fn delete_track(c: &Connection, id: i64) -> AppResult<()> {
    c.execute("DELETE FROM tracks WHERE id = ?1", [id])?;
    Ok(())
}

// ── Favorites & history ──────────────────────────────────────────────────────

fn ensure_track(c: &Connection, id: i64) -> AppResult<()> {
    let exists: bool = c.query_row("SELECT EXISTS(SELECT 1 FROM tracks WHERE id = ?1)", [id], |r| r.get(0))?;
    if exists { Ok(()) } else { Err(AppError::NotFound("titre".into())) }
}

/// Returns the new state: true = now a favorite.
pub fn toggle_favorite(c: &Connection, track_id: i64) -> AppResult<bool> {
    ensure_track(c, track_id)?;
    if c.execute("DELETE FROM favorites WHERE track_id = ?1", [track_id])? > 0 {
        return Ok(false);
    }
    c.execute("INSERT INTO favorites (track_id, added_at) VALUES (?1, ?2)", params![track_id, now()])?;
    Ok(true)
}

pub fn record_play(c: &Connection, track_id: i64) -> AppResult<()> {
    c.execute("INSERT INTO history (track_id, played_at) VALUES (?1, ?2)", params![track_id, now()])?;
    c.execute("DELETE FROM history WHERE id <= (SELECT MAX(id) FROM history) - ?1", [MAX_HISTORY])?;
    Ok(())
}

/// Most recently played distinct tracks.
pub fn recent_history(c: &Connection, limit: i64) -> AppResult<Vec<Track>> {
    let mut stmt = c.prepare(&format!(
        "SELECT {TRACK_COLS} FROM (SELECT track_id, MAX(id) AS last FROM history GROUP BY track_id ORDER BY last DESC LIMIT ?1) h
         JOIN tracks t ON t.id = h.track_id LEFT JOIN favorites f ON f.track_id = t.id ORDER BY h.last DESC"
    ))?;
    Ok(stmt.query_map([limit], track)?.collect::<Result<_, _>>()?)
}

// ── Playlists ────────────────────────────────────────────────────────────────

const PLAYLIST_SELECT: &str = "SELECT p.id, p.name, COUNT(pt.track_id), COALESCE(SUM(t.duration_ms), 0),
    (SELECT t2.cover FROM playlist_tracks pt2 JOIN tracks t2 ON t2.id = pt2.track_id
      WHERE pt2.playlist_id = p.id AND t2.cover IS NOT NULL ORDER BY pt2.position LIMIT 1)
  FROM playlists p LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id LEFT JOIN tracks t ON t.id = pt.track_id";

fn playlist(r: &Row) -> rusqlite::Result<Playlist> {
    Ok(Playlist { id: r.get(0)?, name: r.get(1)?, track_count: r.get(2)?, duration_ms: r.get(3)?, cover: r.get(4)? })
}

fn clean_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::Invalid("Le nom de la playlist est vide".into()));
    }
    Ok(name.chars().take(MAX_NAME).collect())
}

fn touch(c: &Connection, id: i64) -> AppResult<()> {
    if c.execute("UPDATE playlists SET updated_at = ?2 WHERE id = ?1", params![id, now()])? == 0 {
        return Err(AppError::NotFound("playlist".into()));
    }
    Ok(())
}

pub fn playlists(c: &Connection) -> AppResult<Vec<Playlist>> {
    let mut stmt = c.prepare(&format!("{PLAYLIST_SELECT} GROUP BY p.id ORDER BY p.updated_at DESC, p.id DESC"))?;
    Ok(stmt.query_map([], playlist)?.collect::<Result<_, _>>()?)
}

pub fn playlist_get(c: &Connection, id: i64) -> AppResult<PlaylistDetail> {
    let p = c
        .query_row(&format!("{PLAYLIST_SELECT} WHERE p.id = ?1 GROUP BY p.id"), [id], playlist)
        .optional()?
        .ok_or_else(|| AppError::NotFound("playlist".into()))?;
    let mut stmt = c.prepare(&format!(
        "SELECT {TRACK_COLS}, pt.position FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id
         LEFT JOIN favorites f ON f.track_id = t.id WHERE pt.playlist_id = ?1 ORDER BY pt.position"
    ))?;
    let rows = stmt.query_map([id], |r| Ok((track(r)?, r.get::<_, i64>(14)?)))?;
    let (tracks, positions) = rows.collect::<Result<Vec<_>, _>>()?.into_iter().unzip();
    Ok(PlaylistDetail { playlist: p, tracks, positions })
}

pub fn playlist_create(c: &Connection, name: &str) -> AppResult<Playlist> {
    let name = clean_name(name)?;
    let ts = now();
    c.execute("INSERT INTO playlists (name, created_at, updated_at) VALUES (?1, ?2, ?2)", params![name, ts])?;
    Ok(Playlist { id: c.last_insert_rowid(), name, track_count: 0, duration_ms: 0, cover: None })
}

pub fn playlist_rename(c: &Connection, id: i64, name: &str) -> AppResult<()> {
    let name = clean_name(name)?;
    c.execute("UPDATE playlists SET name = ?2 WHERE id = ?1", params![id, name])?;
    touch(c, id)
}

pub fn playlist_delete(c: &Connection, id: i64) -> AppResult<()> {
    if c.execute("DELETE FROM playlists WHERE id = ?1", [id])? == 0 {
        return Err(AppError::NotFound("playlist".into()));
    }
    Ok(())
}

pub fn playlist_add(c: &mut Connection, id: i64, track_ids: &[i64]) -> AppResult<()> {
    let tx = c.transaction()?;
    touch(&tx, id)?;
    let mut next: i64 = tx.query_row("SELECT COALESCE(MAX(position), 0) FROM playlist_tracks WHERE playlist_id = ?1", [id], |r| r.get(0))?;
    for track_id in track_ids {
        ensure_track(&tx, *track_id)?;
        next += 1;
        tx.execute("INSERT INTO playlist_tracks (playlist_id, position, track_id) VALUES (?1, ?2, ?3)", params![id, next, track_id])?;
    }
    tx.commit()?;
    Ok(())
}

pub fn playlist_remove(c: &Connection, id: i64, position: i64) -> AppResult<()> {
    if c.execute("DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND position = ?2", params![id, position])? == 0 {
        return Err(AppError::NotFound("titre de la playlist".into()));
    }
    touch(c, id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    fn sample(path: &str, title: &str, album: &str, n: u32) -> NewTrack {
        NewTrack {
            path: path.into(),
            title: title.into(),
            artist: "Artiste".into(),
            album: album.into(),
            album_artist: "Artiste".into(),
            genre: None,
            track_no: Some(n),
            disc_no: None,
            year: Some(2020),
            duration_ms: 180_000,
            format: "mp3".into(),
            cover: None,
            file_size: 1,
            modified_at: 1,
        }
    }

    fn seeded() -> Db {
        let db = Db::open_in_memory().unwrap();
        db.with(|c| {
            let f = insert_folder(c, "C:\\Musique")?;
            upsert_track(c, f, &sample("C:\\Musique\\b.mp3", "Deuxième", "Album A", 2))?;
            upsert_track(c, f, &sample("C:\\Musique\\a.mp3", "Premier 100%", "Album A", 1))?;
            upsert_track(c, f, &sample("C:\\Musique\\c.mp3", "Autre", "Album B", 1))?;
            Ok(())
        })
        .unwrap();
        db
    }

    #[test]
    fn album_order_search_and_stats() {
        let db = seeded();
        db.with(|c| {
            let q = TrackQuery { album: Some("Album A".into()), album_artist: Some("Artiste".into()), ..Default::default() };
            let titles: Vec<_> = tracks(c, &q)?.into_iter().map(|t| t.title).collect();
            assert_eq!(titles, ["Premier 100%", "Deuxième"]);
            // `%` is matched literally, not as a wildcard.
            assert_eq!(tracks(c, &TrackQuery { search: Some("100%".into()), ..Default::default() })?.len(), 1);
            assert_eq!(tracks(c, &TrackQuery { search: Some("premier ALBUM".into()), ..Default::default() })?.len(), 1);
            let s = stats(c)?;
            assert_eq!((s.tracks, s.albums, s.artists), (3, 2, 1));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn search_ignores_accents_and_case() {
        assert_eq!(fold("L'Été Œuvre STRASSE Straße"), "l'ete oeuvre strasse strasse");
        let db = seeded();
        db.with(|c| {
            upsert_track(c, 1, &sample("C:\\Musique\\d.mp3", "Dernier Métro", "Noël à Paris", 4))?;
            let n = |c: &Connection, q: &str| tracks(c, &TrackQuery { search: Some(q.into()), ..Default::default() }).map(|v| v.len());
            assert_eq!(n(c, "METRO")?, 1);
            assert_eq!(n(c, "dernier métro")?, 1);
            assert_eq!(n(c, "noel a paris")?, 1);
            assert_eq!(n(c, "DEUXIEME")?, 1);
            assert_eq!(n(c, "métro absent")?, 0);
            // Rows written before migration 2 get their search text at startup.
            c.execute("UPDATE tracks SET search = ''", [])?;
            assert_eq!(n(c, "metro")?, 0);
            assert_eq!(backfill_search(c)?, 4);
            assert_eq!(n(c, "metro")?, 1);
            assert_eq!(backfill_search(c)?, 0);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn rescan_keeps_id_and_favorite() {
        let db = seeded();
        db.with(|c| {
            let id = tracks(c, &TrackQuery::default())?[0].id;
            assert!(toggle_favorite(c, id)?);
            let path: String = c.query_row("SELECT path FROM tracks WHERE id = ?1", [id], |r| r.get(0))?;
            let mut t = sample(&path, "Renommé", "Album A", 1);
            t.modified_at = 2;
            upsert_track(c, 1, &t)?;
            let fav = tracks(c, &TrackQuery { favorites: true, ..Default::default() })?;
            assert_eq!((fav.len(), fav[0].id, fav[0].title.as_str()), (1, id, "Renommé"));
            assert!(!toggle_favorite(c, id)?);
            assert!(toggle_favorite(c, 9999).is_err());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn playlists_lifecycle() {
        let db = seeded();
        db.with(|c| {
            assert!(playlist_create(c, "   ").is_err());
            let p = playlist_create(c, "  Soirée ")?;
            assert_eq!(p.name, "Soirée");
            let ids: Vec<i64> = tracks(c, &TrackQuery::default())?.iter().map(|t| t.id).collect();
            playlist_add(c, p.id, &[ids[0], ids[1], ids[0]])?;
            let d = playlist_get(c, p.id)?;
            assert_eq!((d.tracks.len(), d.positions.clone()), (3, vec![1, 2, 3]));
            playlist_remove(c, p.id, 2)?;
            assert_eq!(playlist_get(c, p.id)?.positions, vec![1, 3]);
            assert!(playlist_add(c, p.id, &[424242]).is_err(), "unknown track rejected");
            assert_eq!(playlist_get(c, p.id)?.tracks.len(), 2, "failed add rolled back");
            // Removing a folder cascades to its tracks and their playlist entries.
            remove_folder(c, 1)?;
            assert_eq!(playlist_get(c, p.id)?.tracks.len(), 0);
            playlist_delete(c, p.id)?;
            assert!(playlist_get(c, p.id).is_err());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn history_is_distinct_and_recent_first() {
        let db = seeded();
        db.with(|c| {
            let ids: Vec<i64> = tracks(c, &TrackQuery::default())?.iter().map(|t| t.id).collect();
            for id in [ids[0], ids[1], ids[0]] {
                record_play(c, id)?;
            }
            let recent: Vec<i64> = recent_history(c, 10)?.iter().map(|t| t.id).collect();
            assert_eq!(recent, vec![ids[0], ids[1]]);
            Ok(())
        })
        .unwrap();
    }
}
