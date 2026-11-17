export type Source = "deezer" | "itunes" | "local";

/** `id` is prefixed by source (`dz-27`, `it-909253`); local files have no artist id. */
export interface ArtistRef {
  id?: string;
  name: string;
}

export interface Track {
  /** `dz-<id>`, `it-<id>` or `local:<absolute path>`. */
  id: string;
  title: string;
  artists: ArtistRef[];
  album?: { id?: string; title: string };
  cover?: string;
  coverLarge?: string;
  /** Full track length in seconds; 0 when unknown (local files before first play). */
  duration: number;
  explicit: boolean;
  /** Deezer popularity (0-1 000 000), used to drop low-ranked duplicates of the same title. */
  rank?: number;
  /** Remote: preview URL. Local: absolute file path (converted to an asset URL at play time). */
  src: string;
  source: Source;
}

export interface Artist {
  id: string;
  name: string;
  picture?: string;
  pictureLarge?: string;
  fans?: number;
}

export interface Album {
  id: string;
  title: string;
  cover?: string;
  year?: string;
  type?: string;
}

export interface ArtistPageData {
  artist: Artist;
  top: Track[];
  albums: Album[];
}

export interface AlbumPageData {
  album: Album;
  coverLarge?: string;
  artists: ArtistRef[];
  label?: string;
  tracks: Track[];
}

export interface SearchResults {
  tracks: Track[];
  artists: Artist[];
  topArtist?: Artist;
  suggestions: string[];
}

export interface HomeData {
  tracks: Track[];
  artists: Artist[];
}

export type AudioQuality = "low" | "normal" | "high" | "lossless";

export interface Profile {
  displayName: string;
  /** Avatar hue (0-360). */
  hue: number;
}

export interface AudioSources {
  /** Full-length audio resolved by the Rust backend (YouTube Music via Piped/Invidious). */
  fullStream: boolean;
  /** Deezer 30 s previews, only when every full-length source failed. On by default. */
  previewFallback: boolean;
}

export interface Settings {
  audioQuality: AudioQuality;
  sources: AudioSources;
  hardwareAcceleration: boolean;
  profile: Profile;
}

export type Route =
  | { name: "home" }
  | { name: "search" }
  | { name: "library" }
  | { name: "settings" }
  | { name: "artist"; id: string }
  | { name: "album"; id: string };
