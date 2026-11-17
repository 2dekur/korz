import { convertFileSrc } from "@tauri-apps/api/core";
import type { Album, Artist, ArtistPageData, HomeData, SearchResults, Track } from "@/types";
import { buildSuggestions, cleanArtists, cleanTracks, pickTopArtist, previewExpired, relevantArtists } from "@/lib/music";
import { getJson } from "./http";

// ---- Deezer (primary, public API, no key) -----------------------------------------------

const DZ = "https://api.deezer.com";

interface DzArtist { id: number; name: string; picture_medium?: string; picture_xl?: string; nb_fan?: number }
interface DzAlbum { id: number; title: string; cover_medium?: string; cover_xl?: string; release_date?: string; record_type?: string }
interface DzTrack {
  id: number;
  title: string;
  duration: number;
  rank?: number;
  explicit_lyrics: boolean;
  preview: string;
  readable?: boolean;
  artist: DzArtist;
  album?: DzAlbum;
  contributors?: DzArtist[];
}
type DzError = { error: { type: string; message: string } };

async function dz<T>(path: string, signal?: AbortSignal): Promise<T> {
  const json = await getJson<T | DzError>(DZ + path, signal);
  // Deezer reports errors (quota, not found) with HTTP 200.
  if (typeof json === "object" && json !== null && "error" in json) throw new Error(`Deezer : ${json.error.message}`);
  return json as T;
}

const dzArtist = (a: DzArtist): Artist => ({
  id: `dz-${a.id}`,
  name: a.name,
  picture: a.picture_medium,
  pictureLarge: a.picture_xl,
  fans: a.nb_fan,
});

const dzTrack = (t: DzTrack): Track => ({
  id: `dz-${t.id}`,
  title: t.title,
  artists: (t.contributors?.length ? t.contributors : [t.artist]).map((a) => ({ id: `dz-${a.id}`, name: a.name })),
  album: t.album && { id: `dz-${t.album.id}`, title: t.album.title },
  cover: t.album?.cover_medium,
  coverLarge: t.album?.cover_xl,
  duration: t.duration,
  explicit: t.explicit_lyrics,
  rank: t.rank,
  src: t.preview,
  source: "deezer",
});

const RECORD_TYPES: Record<string, string> = { album: "Album", single: "Single", ep: "EP", compile: "Compilation" };

const playable = (t: DzTrack) => t.readable !== false && !!t.preview;

// ---- iTunes Search (fallback when Deezer is unreachable) -------------------------------

const IT = "https://itunes.apple.com";

interface ItItem {
  wrapperType: "track" | "artist" | "collection";
  trackId?: number;
  trackName?: string;
  artistId: number;
  artistName: string;
  collectionId?: number;
  collectionName?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  trackExplicitness?: string;
  previewUrl?: string;
  releaseDate?: string;
  collectionType?: string;
}

const itArt = (url: string | undefined, size: number) => url?.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`);

const itTrack = (i: ItItem): Track => ({
  id: `it-${i.trackId}`,
  title: i.trackName ?? "",
  artists: [{ id: `it-${i.artistId}`, name: i.artistName }],
  album: i.collectionName ? { id: `it-${i.collectionId}`, title: i.collectionName } : undefined,
  cover: itArt(i.artworkUrl100, 250),
  coverLarge: itArt(i.artworkUrl100, 1000),
  duration: Math.round((i.trackTimeMillis ?? 0) / 1000),
  explicit: i.trackExplicitness === "explicit",
  src: i.previewUrl ?? "",
  source: "itunes",
});

async function itunesSearch(q: string, signal?: AbortSignal): Promise<{ tracks: Track[]; artists: Artist[] }> {
  const { results } = await getJson<{ results: ItItem[] }>(
    `${IT}/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=40`,
    signal,
  );
  const tracks = results.filter((r) => r.wrapperType === "track" && r.previewUrl).map(itTrack);
  // iTunes has no artist photos: the artist's first artwork stands in.
  const artists = new Map<string, Artist>();
  for (const t of tracks) {
    const a = t.artists[0]!;
    if (!artists.has(a.id!)) artists.set(a.id!, { id: a.id!, name: a.name, picture: t.cover, pictureLarge: t.coverLarge });
  }
  return { tracks, artists: [...artists.values()] };
}

// ---- Public API --------------------------------------------------------------------------

export async function searchCatalog(query: string, signal?: AbortSignal): Promise<SearchResults> {
  const q = encodeURIComponent(query);
  let tracks: Track[];
  let artists: Artist[];
  try {
    const [t, a] = await Promise.all([
      dz<{ data: DzTrack[] }>(`/search?q=${q}&limit=40`, signal),
      dz<{ data: DzArtist[] }>(`/search/artist?q=${q}&limit=10`, signal),
    ]);
    tracks = t.data.filter(playable).map(dzTrack);
    artists = a.data.map(dzArtist);
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn("Deezer indisponible, repli sur iTunes", err);
    ({ tracks, artists } = await itunesSearch(query, signal));
  }
  tracks = cleanTracks(tracks, query);
  artists = relevantArtists(cleanArtists(artists, query), tracks);
  const topArtist = pickTopArtist(query, artists, tracks);
  return {
    tracks,
    artists: topArtist ? [topArtist, ...artists.filter((a) => a.id !== topArtist.id)] : artists,
    topArtist,
    suggestions: buildSuggestions(query, artists, tracks),
  };
}

const albumKey = (title: string) => title.toLowerCase().replace(/\s*[([].*$/, "").trim();

/** Keeps one edition per album title (Deezer lists deluxe/remaster/drumless…), newest first. */
function dedupeAlbums(albums: Album[]): Album[] {
  const seen = new Set<string>();
  return albums
    .sort((a, b) => (b.year ?? "").localeCompare(a.year ?? ""))
    .filter((a) => !seen.has(albumKey(a.title)) && !!seen.add(albumKey(a.title)));
}

export async function getArtistPage(id: string, signal?: AbortSignal): Promise<ArtistPageData> {
  const [source, raw] = [id.slice(0, 2), id.slice(3)];
  if (!/^\d+$/.test(raw)) throw new Error("Identifiant d'artiste invalide");

  if (source === "dz") {
    const [artist, top, albums] = await Promise.all([
      dz<DzArtist>(`/artist/${raw}`, signal),
      dz<{ data: DzTrack[] }>(`/artist/${raw}/top?limit=10`, signal),
      dz<{ data: DzAlbum[] }>(`/artist/${raw}/albums?limit=100`, signal),
    ]);
    return {
      artist: dzArtist(artist),
      top: top.data.filter(playable).map(dzTrack),
      albums: dedupeAlbums(
        albums.data.map((a) => ({
          id: `dz-${a.id}`,
          title: a.title,
          cover: a.cover_medium,
          year: a.release_date?.slice(0, 4),
          type: RECORD_TYPES[a.record_type ?? ""] ?? "Album",
        })),
      ),
    };
  }

  const [songs, albums] = await Promise.all([
    getJson<{ results: ItItem[] }>(`${IT}/lookup?id=${raw}&entity=song&limit=10`, signal),
    getJson<{ results: ItItem[] }>(`${IT}/lookup?id=${raw}&entity=album&limit=50`, signal),
  ]);
  const head = songs.results.find((r) => r.wrapperType === "artist");
  const top = songs.results.filter((r) => r.wrapperType === "track" && r.previewUrl).map(itTrack);
  if (!head) throw new Error("Artiste introuvable");
  return {
    artist: { id, name: head.artistName, picture: top[0]?.cover, pictureLarge: top[0]?.coverLarge },
    top,
    albums: dedupeAlbums(
      albums.results
        .filter((r) => r.wrapperType === "collection")
        .map((r) => ({
          id: `it-${r.collectionId}`,
          title: r.collectionName ?? "",
          cover: itArt(r.artworkUrl100, 250),
          year: r.releaseDate?.slice(0, 4),
          type: "Album",
        })),
    ),
  };
}

export async function getHome(signal?: AbortSignal): Promise<HomeData> {
  const chart = await dz<{ tracks: { data: DzTrack[] }; artists: { data: DzArtist[] } }>("/chart/0?limit=12", signal);
  return { tracks: chart.tracks.data.filter(playable).map(dzTrack), artists: chart.artists.data.map(dzArtist) };
}

/** URL the <audio> element can load. Deezer previews are signed and expire, so stale ones are re-fetched. */
export async function playableSrc(track: Track): Promise<string> {
  if (track.source === "local") return convertFileSrc(track.src);
  if (track.source === "deezer" && previewExpired(track.src)) {
    const fresh = await dz<DzTrack>(`/track/${track.id.slice(3)}`);
    return fresh.preview;
  }
  return track.src;
}
