import type { Track } from "@/types";
import { activeLineIndex, chunkLines, parseLrc, parsePlain, type LyricLine } from "@/lib/lyrics";
import { getJson } from "./http";

export { activeLineIndex, type LyricLine };

export type Lyrics =
  | { kind: "synced"; lines: LyricLine[] }
  | { kind: "plain"; lines: LyricLine[] }
  | { kind: "instrumental" }
  | { kind: "none" };

interface LrclibItem {
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const LRCLIB = "https://lrclib.net/api";

const toLyrics = (item: LrclibItem): Lyrics =>
  item.instrumental
    ? { kind: "instrumental" }
    : item.syncedLyrics
      ? { kind: "synced", lines: parseLrc(item.syncedLyrics) }
      : item.plainLyrics
        ? { kind: "plain", lines: parsePlain(item.plainLyrics) }
        : { kind: "none" };

/** Exact match on LRCLIB (artist + title + duration); falls back to a search within ±3 s, synced preferred. */
export async function fetchLyrics(track: Track, duration: number): Promise<Lyrics> {
  const artist = track.artists[0]?.name ?? "";
  const title = track.title.replace(/\s*[([].*$/, "").trim() || track.title;
  const params = new URLSearchParams({ artist_name: artist, track_name: title });
  if (track.album?.title) params.set("album_name", track.album.title);
  if (duration > 0) params.set("duration", String(Math.round(duration)));
  try {
    return toLyrics(await getJson<LrclibItem>(`${LRCLIB}/get?${params}`));
  } catch (err) {
    // 404 = no exact match: try the looser search before giving up.
    if (!String(err).includes("404")) throw err;
  }
  const search = new URLSearchParams({ track_name: title });
  if (artist && artist !== "Artiste inconnu") search.set("artist_name", artist);
  const items = await getJson<LrclibItem[]>(`${LRCLIB}/search?${search}`);
  const close = items.filter((i) => !duration || Math.abs((i.duration ?? 0) - duration) <= 3);
  const best = close.find((i) => i.syncedLyrics) ?? close.find((i) => i.plainLyrics) ?? close[0];
  return best ? toLyrics(best) : { kind: "none" };
}

interface MyMemoryResponse {
  responseStatus: number | string;
  responseDetails?: string;
  quotaFinished?: boolean;
  responseData: { translatedText: string; detectedLanguage?: string };
}

export interface Translation {
  /** Same length as the source lines; "" for empty source lines. */
  lines: string[];
  /** Source already French: nothing to show. */
  alreadyFrench: boolean;
}

/** Translates lines to French in newline-joined batches (one request per ~450 bytes). */
export async function translateToFrench(lines: string[]): Promise<Translation> {
  const indexed = lines.map((text, i) => ({ text, i })).filter((l) => l.text.trim());
  const out = lines.map(() => "");
  const chunks = chunkLines(indexed.map((l) => l.text));
  let cursor = 0;
  for (const chunk of chunks) {
    const q = new URLSearchParams({ q: chunk.join("\n"), langpair: "autodetect|fr" });
    const res = await getJson<MyMemoryResponse>(`https://api.mymemory.translated.net/get?${q}`);
    if (res.quotaFinished) throw new Error("Quota de traduction du jour atteint");
    // Autodetected French source: MyMemory refuses fr→fr with this message instead of echoing the text.
    const details = `${res.responseDetails ?? ""} ${res.responseData?.translatedText ?? ""}`;
    if (/DISTINCT LANGUAGES/i.test(details) || res.responseData?.detectedLanguage?.toLowerCase().startsWith("fr")) {
      return { lines: out, alreadyFrench: true };
    }
    if (Number(res.responseStatus) !== 200) throw new Error(res.responseDetails || "Traduction indisponible");
    const translated = res.responseData.translatedText.split("\n");
    chunk.forEach((_, k) => {
      out[indexed[cursor + k]!.i] = translated[k]?.trim() ?? "";
    });
    cursor += chunk.length;
  }
  return { lines: out, alreadyFrench: false };
}
