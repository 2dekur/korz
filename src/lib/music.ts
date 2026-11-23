// Pure helpers (no Tauri imports) so they run under `node --test`.
import type { Artist, ArtistRef, Track } from "../types/index.ts";
import { normalize } from "./format.ts";

/** Versions nobody asked for. Each term is only filtered when the query does not contain it. */
const NOISE_TERMS = [
  "karaoke",
  "tribute",
  "8d",
  "8d audio",
  "slowed",
  "nightcore",
  "sped up",
  "remix",
  "in the style of",
  "originally performed",
  "made famous",
];

export function isNoise(text: string, query: string): boolean {
  const t = normalize(text);
  const q = normalize(query);
  return NOISE_TERMS.some((term) => !q.includes(term) && new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`).test(t));
}

const trackText = (t: Track) => `${t.title} ${t.album?.title ?? ""} ${t.artists.map((a) => a.name).join(" ")}`;

const baseTitle = (title: string) => normalize(title).replace(/\s*[([].*$/, "").replace(/\s+-\s+.*$/, "").trim();

/** A track is "asked for" when the query has words beyond the title and the track matches them (e.g. "acoustic", a cover artist). */
function asked(t: Track, query: string): boolean {
  const base = baseTitle(t.title);
  const extra = normalize(query).split(/\s+/).filter((w) => w && !base.includes(w));
  const text = normalize(trackText(t));
  return extra.length > 0 && extra.every((w) => text.includes(w));
}

/** Variants by other artists below this share of the best rank for the same title are treated as unrequested covers. */
const COVER_RANK_RATIO = 0.85;

/**
 * Drops noise versions, exact duplicates (same base title + main artist, first kept), and low-ranked covers of a
 * title whose original ranks far higher — unless the query asks for them.
 */
export function cleanTracks(tracks: Track[], query: string): Track[] {
  const bestRank = new Map<string, number>();
  for (const t of tracks) {
    const b = baseTitle(t.title);
    if (t.rank !== undefined) bestRank.set(b, Math.max(bestRank.get(b) ?? 0, t.rank));
  }
  const seen = new Set<string>();
  return tracks.filter((t) => {
    if (isNoise(trackText(t), query)) return false;
    const b = baseTitle(t.title);
    const key = `${b}|${normalize(t.artists[0]?.name ?? "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const best = bestRank.get(b);
    return t.rank === undefined || best === undefined || t.rank >= best * COVER_RANK_RATIO || asked(t, query);
  });
}

const MIN_FANS = 5_000;

const trackArtistIds = (tracks: Track[]) => new Set(tracks.flatMap((t) => t.artists.map((a) => a.id)));

/** Keeps artists that show up in the track results or have a real audience; drops name-squatting profiles. */
export function relevantArtists(artists: Artist[], tracks: Track[]): Artist[] {
  const ids = trackArtistIds(tracks);
  return artists.filter((a) => ids.has(a.id) || (a.fans ?? 0) >= MIN_FANS);
}

export function cleanArtists(artists: Artist[], query: string): Artist[] {
  const seen = new Set<string>();
  return artists.filter((a) => !isNoise(a.name, query) && !seen.has(a.id) && seen.add(a.id));
}

/**
 * Deezer's own artist ranking is poor for partial queries ("daft" -> "Daft"), so the top artist is the one
 * that best combines: exact name match, presence among top track results, and audience size.
 */
export function pickTopArtist(query: string, artists: Artist[], tracks: Track[]): Artist | undefined {
  const q = normalize(query.trim());
  const inTracks = new Map<string, number>();
  for (const t of tracks.slice(0, 15)) for (const a of t.artists) if (a.id) inTracks.set(a.id, (inTracks.get(a.id) ?? 0) + 1);
  let best: Artist | undefined;
  let bestScore = -Infinity;
  for (const a of artists) {
    if (!inTracks.has(a.id) && (a.fans ?? 0) < MIN_FANS) continue;
    const name = normalize(a.name);
    const score =
      (name === q ? 4 : name.startsWith(q) ? 1 : 0) + (inTracks.get(a.id) ?? 0) + Math.log10((a.fans ?? 0) + 1) / 2;
    if (score > bestScore) [best, bestScore] = [a, score];
  }
  return best;
}

export function buildSuggestions(query: string, artists: Artist[], tracks: Track[], max = 4): string[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const out = new Map<string, string>();
  const add = (s: string) => {
    const n = normalize(s);
    if (n !== q && n.includes(q) && !out.has(n)) out.set(n, s.toLowerCase());
  };
  for (const a of artists.slice(0, 3)) add(a.name);
  for (const t of tracks.slice(0, 8)) add(`${t.artists[0]?.name ?? ""} ${t.title.replace(/\s*[([].*$/, "")}`.trim());
  return [...out.values()].slice(0, max);
}

/** Deezer preview URLs carry `exp=<unix seconds>`; treat as expired one minute early. */
export function previewExpired(url: string, nowMs = Date.now()): boolean {
  const exp = /[?&~=]exp=(\d+)/.exec(url)?.[1];
  return exp !== undefined && Number(exp) * 1000 < nowMs + 60_000;
}

export const AUDIO_FILE = /\.(mp3|flac|wav|m4a|aac|ogg|opus)$/i;

/** `Artist - Title.ext` → artist + title; otherwise the file name is the title. Parent folder = album. */
/** "SDM, Ninho & Gims et Vacra" → names. A lone "&" inside a name like "Simon & Garfunkel" is a known limit. */
export function splitArtistNames(text: string): string[] {
  return text
    .split(/\s*(?:,|&|\bet\b|\band\b|\bx\b)\s*/i)
    .map((n) => n.trim())
    .filter(Boolean);
}

const FEAT_BRACKETED = /[([]\s*(?:feat\.?|ft\.?|featuring|avec|with)\s+([^)\]]+)[)\]]/gi;
const FEAT_TRAILING = /\s(?:feat\.?|ft\.?|featuring)\s+(.+)$/i;

/** Artists credited in a title: "(feat. A & B)", "[ft. A]", "(avec A)", "… feat. A". */
export function featuredFromTitle(title: string): ArtistRef[] {
  const names = [...title.matchAll(FEAT_BRACKETED)].flatMap((m) => splitArtistNames(m[1]!));
  const bare = title.replace(FEAT_BRACKETED, "");
  const trailing = FEAT_TRAILING.exec(bare)?.[1];
  if (trailing) names.push(...splitArtistNames(trailing));
  return names.map((name) => ({ name }));
}

/** Concatenates artist lists in order, dropping case/accent-insensitive duplicates; an entry with an id wins. */
export function mergeArtists(...lists: ArtistRef[][]): ArtistRef[] {
  const out: ArtistRef[] = [];
  for (const a of lists.flat()) {
    const key = normalize(a.name);
    if (!key) continue;
    const i = out.findIndex((o) => normalize(o.name) === key);
    if (i < 0) out.push(a);
    else if (!out[i]!.id && a.id) out[i] = a;
  }
  return out;
}

/** Every artist of a track: credits first, then featurings named in the title. */
export const allArtists = (track: Track, credits?: ArtistRef[]): ArtistRef[] =>
  mergeArtists(credits ?? [], track.artists, featuredFromTitle(track.title));

export function trackFromFile(path: string): Track {
  const parts = path.split(/[\\/]/);
  const file = parts.at(-1) ?? path;
  const folder = parts.at(-2);
  const base = file.replace(/\.[^.]+$/, "").replace(/^\d{1,3}[\s.\-_]+/, "");
  const dash = base.indexOf(" - ");
  return {
    id: `local:${path}`,
    title: dash > 0 ? base.slice(dash + 3).trim() : base.trim(),
    artists: dash > 0 ? splitArtistNames(base.slice(0, dash).replace(/\s(?:feat\.?|ft\.?)\s/gi, ", ")).map((name) => ({ name })) : [{ name: "Artiste inconnu" }],
    album: folder ? { title: folder } : undefined,
    duration: 0,
    explicit: false,
    src: path,
    source: "local",
  };
}

export function hueFromSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}
