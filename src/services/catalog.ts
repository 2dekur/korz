import type { Artist, Track } from "@/types";
import { normalize } from "@/lib/format";

// shortcut: test catalog streamed from SoundHelix demo MP3s (needs network), replace with real sources in v0.0.2+.
const helix = (n: number) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

export const artists: Artist[] = [
  { id: "nova-lane", name: "Nova Lane", genre: "Synthwave", hue: 262 },
  { id: "kairo", name: "Kairo", genre: "Électro", hue: 188 },
  { id: "les-heures-claires", name: "Les Heures Claires", genre: "Indie pop", hue: 24 },
  { id: "mira-sol", name: "Mira Sol", genre: "Downtempo", hue: 330 },
  { id: "atlas-drift", name: "Atlas Drift", genre: "Ambient", hue: 150 },
];

const raw: [title: string, artistId: string, album: string][] = [
  ["Néons sous la pluie", "nova-lane", "Midnight Transit"],
  ["Autoroute 84", "nova-lane", "Midnight Transit"],
  ["Chrome Hearts", "nova-lane", "Midnight Transit"],
  ["Pulse", "kairo", "Fréquences"],
  ["Basse Ville", "kairo", "Fréquences"],
  ["Signal Perdu", "kairo", "Fréquences"],
  ["L'été indien", "les-heures-claires", "Carnets"],
  ["Rue des Martyrs", "les-heures-claires", "Carnets"],
  ["Deuxième étage", "les-heures-claires", "Carnets"],
  ["Sable chaud", "mira-sol", "Siesta"],
  ["Lente marée", "mira-sol", "Siesta"],
  ["Orange amère", "mira-sol", "Siesta"],
  ["Altitude", "atlas-drift", "Cartographie"],
  ["Glacier", "atlas-drift", "Cartographie"],
  ["Ligne d'horizon", "atlas-drift", "Cartographie"],
  ["Dernière lumière", "atlas-drift", "Cartographie"],
];

const artistById = new Map(artists.map((a) => [a.id, a]));

export const tracks: Track[] = raw.map(([title, artistId, album], i) => ({
  id: `t${i + 1}`,
  title,
  artistId,
  album,
  src: helix(i + 1),
  hue: ((artistById.get(artistId)?.hue ?? 0) + i * 17) % 360,
}));

export const getArtist = (id: string) => artistById.get(id);
export const tracksByArtist = (id: string) => tracks.filter((t) => t.artistId === id);

const index = tracks.map((t) => ({
  track: t,
  haystack: normalize(`${t.title} ${artistById.get(t.artistId)?.name ?? ""} ${t.album}`),
}));
const cache = new Map<string, { tracks: Track[]; artists: Artist[] }>();

/** Strict local search: every query token must appear. Results are memoized per query. */
export function search(query: string) {
  const key = normalize(query.trim());
  const hit = cache.get(key);
  if (hit) return hit;
  const tokens = key.split(/\s+/).filter(Boolean);
  const result = tokens.length
    ? {
        tracks: index.filter((e) => tokens.every((tk) => e.haystack.includes(tk))).map((e) => e.track),
        artists: artists.filter((a) => tokens.every((tk) => normalize(a.name).includes(tk))),
      }
    : { tracks: [], artists: [] };
  cache.set(key, result);
  return result;
}
