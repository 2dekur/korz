/** Mirrors the serde DTOs of src-tauri/src/library/models.rs and audio/mod.rs (camelCase). */

export interface Track {
  id: number;
  path: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string | null;
  trackNo: number | null;
  discNo: number | null;
  year: number | null;
  durationMs: number;
  format: string;
  cover: string | null;
  favorite: boolean;
}

export interface Album {
  title: string;
  artist: string;
  year: number | null;
  cover: string | null;
  trackCount: number;
  durationMs: number;
}

export interface Artist {
  name: string;
  albumCount: number;
  trackCount: number;
  cover: string | null;
}

export interface Folder {
  id: number;
  path: string;
  trackCount: number;
}

export interface Playlist {
  id: number;
  name: string;
  trackCount: number;
  durationMs: number;
  cover: string | null;
}

export interface PlaylistDetail {
  playlist: Playlist;
  tracks: Track[];
  /** Same length as `tracks`: the row key used to remove an entry. */
  positions: number[];
}

export interface LibraryStats {
  tracks: number;
  albums: number;
  artists: number;
  durationMs: number;
}

export interface ScanSummary {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  failed: number;
}

export interface ScanProgress {
  folder: string;
  done: number;
  total: number;
}

export interface TrackQuery {
  search?: string;
  favorites?: boolean;
  album?: string;
  albumArtist?: string;
  artist?: string;
}

export type PlayerStatus = "idle" | "playing" | "paused";

export interface PlayerState {
  status: PlayerStatus;
  queue: Track[];
  index: number | null;
  volume: number;
  error: string | null;
}

export interface PlayerPosition {
  positionMs: number;
  durationMs: number;
}

export interface LinkInfo {
  provider: "spotify" | "youtube" | "deezer" | "apple-music" | "soundcloud";
  kind: "track" | "album" | "playlist" | "artist" | "video" | "short";
  id: string | null;
}

export interface AppInfo {
  version: string;
  dataDir: string;
  logDir: string;
}

export interface AppErrorPayload {
  code: string;
  message: string;
}

export type Route =
  | { name: "home" }
  | { name: "search" }
  | { name: "library"; tab?: "tracks" | "albums" | "artists" }
  | { name: "album"; title: string; artist: string }
  | { name: "artist"; artist: string }
  | { name: "playlists" }
  | { name: "playlist"; id: number }
  | { name: "favorites" }
  | { name: "import" }
  | { name: "services" }
  | { name: "settings" };
