import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  Album,
  AppErrorPayload,
  AppInfo,
  Artist,
  Folder,
  LibraryStats,
  LinkInfo,
  PlayerPosition,
  PlayerState,
  Playlist,
  PlaylistDetail,
  ScanProgress,
  ScanSummary,
  Track,
  TrackQuery,
} from "@/types";

/** Typed wrappers over the Rust commands (src-tauri/src/commands.rs). The frontend holds no business logic. */
export const api = {
  appInfo: () => invoke<AppInfo>("app_info"),

  folders: () => invoke<Folder[]>("library_folders"),
  addFolder: (path: string) => invoke<ScanSummary>("library_add_folder", { path }),
  removeFolder: (id: number) => invoke<void>("library_remove_folder", { id }),
  rescan: () => invoke<ScanSummary>("library_rescan"),
  stats: () => invoke<LibraryStats>("library_stats"),
  tracks: (query: TrackQuery = {}) => invoke<Track[]>("library_tracks", { query }),
  albums: (artist?: string) => invoke<Album[]>("library_albums", { artist: artist ?? null }),
  artists: () => invoke<Artist[]>("library_artists"),
  recentlyAdded: (limit: number) => invoke<Album[]>("library_recent_albums", { limit }),
  history: (limit: number) => invoke<Track[]>("history_recent", { limit }),
  toggleFavorite: (trackId: number) => invoke<boolean>("favorite_toggle", { trackId }),

  playlists: () => invoke<Playlist[]>("playlists_list"),
  playlist: (id: number) => invoke<PlaylistDetail>("playlist_get", { id }),
  createPlaylist: (name: string) => invoke<Playlist>("playlist_create", { name }),
  renamePlaylist: (id: number, name: string) => invoke<void>("playlist_rename", { id, name }),
  deletePlaylist: (id: number) => invoke<void>("playlist_delete", { id }),
  addToPlaylist: (id: number, trackIds: number[]) => invoke<void>("playlist_add", { id, trackIds }),
  removeFromPlaylist: (id: number, position: number) => invoke<void>("playlist_remove", { id, position }),

  play: (trackIds: number[], index: number) => invoke<void>("player_play", { trackIds, index }),
  enqueue: (trackIds: number[]) => invoke<void>("player_enqueue", { trackIds }),
  jump: (index: number) => invoke<void>("player_jump", { index }),
  toggle: () => invoke<void>("player_toggle"),
  next: () => invoke<void>("player_next"),
  previous: () => invoke<void>("player_previous"),
  seek: (positionMs: number) => invoke<void>("player_seek", { positionMs: Math.round(positionMs) }),
  setVolume: (volume: number) => invoke<void>("player_set_volume", { volume }),
  playerState: () => invoke<PlayerState>("player_state"),

  parseLink: (url: string) => invoke<LinkInfo>("smartlink_parse", { url }),
};

export const events = {
  playerState: (cb: (s: PlayerState) => void): Promise<UnlistenFn> => listen<PlayerState>("player://state", (e) => cb(e.payload)),
  playerPosition: (cb: (p: PlayerPosition) => void): Promise<UnlistenFn> => listen<PlayerPosition>("player://position", (e) => cb(e.payload)),
  scanProgress: (cb: (p: ScanProgress) => void): Promise<UnlistenFn> => listen<ScanProgress>("library://scan", (e) => cb(e.payload)),
};

/** Covers are served by the `korzcover` protocol from the app cache, by content hash only. */
export const coverUrl = (hash: string | null) => (hash ? convertFileSrc(hash, "korzcover") : undefined);

export function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) return String((err as AppErrorPayload).message);
  return String(err);
}
