import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { Track } from "@/types";
import { useSettings } from "@/store/settings";
import { useSearch } from "@/store/search";
import { readKey, writeKey } from "./persist";
import { playableSrc } from "./musicApi";

/**
 * A source that can turn a catalog/local track into something <audio> can play.
 * Order of use: local file → full stream (Rust resolver) → Deezer preview (only if enabled in Settings).
 */
export interface AudioProvider {
  id: "local" | "full" | "preview";
  canPlay: (track: Track) => boolean;
  resolve: (track: Track) => Promise<string>;
}

interface Resolved {
  videoId: string;
  title: string;
  uploader: string;
  duration: number;
}

/** trackId → YouTube video id. Persisted: a track matched once never needs a search again. */
const useStreamIds = create<{ ids: Record<string, string> }>(() => ({ ids: {} }));
const inflight = new Map<string, Promise<string>>();

let saveTimer: ReturnType<typeof setTimeout> | undefined;
useStreamIds.subscribe((s) => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void writeKey("streamIds", s.ids), 500);
});

export async function hydrateStreamIds() {
  const ids = await readKey<Record<string, string>>("streamIds");
  if (ids && typeof ids === "object") useStreamIds.setState({ ids });
}

const request = (track: Track) => ({
  artist: track.artists.map((a) => a.name).join(", "),
  title: track.title,
  duration: track.duration,
  query: useSearch.getState().query || null,
  videoId: useStreamIds.getState().ids[track.id] ?? null,
});

/** Resolves (or prefetches) the full stream; concurrent calls for one track share a single request. */
function resolveFull(track: Track, command: "resolve_stream" | "prefetch_stream"): Promise<string> {
  const key = `${command}:${track.id}`;
  const running = inflight.get(key);
  if (running) return running;
  const p = invoke<Resolved>(command, { req: request(track) })
    .then((r) => {
      useStreamIds.setState((s) => (s.ids[track.id] === r.videoId ? s : { ids: { ...s.ids, [track.id]: r.videoId } }));
      return convertFileSrc(r.videoId, "korzstream");
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export const localProvider: AudioProvider = {
  id: "local",
  canPlay: (t) => t.source === "local",
  resolve: async (t) => convertFileSrc(t.src),
};

export const fullStreamProvider: AudioProvider = {
  id: "full",
  canPlay: (t) => t.source !== "local" && t.duration > 0 && isTauri() && useSettings.getState().sources.fullStream,
  resolve: (t) => resolveFull(t, "resolve_stream"),
};

export const previewProvider: AudioProvider = {
  id: "preview",
  canPlay: (t) => t.source !== "local" && !!t.src && useSettings.getState().sources.previewFallback,
  resolve: playableSrc,
};

const PROVIDERS = [localProvider, fullStreamProvider, previewProvider];

/** First provider that can play the track and succeeds; the first error explains a total failure. */
export async function resolveSource(track: Track): Promise<string> {
  let first: unknown;
  for (const p of PROVIDERS) {
    if (!p.canPlay(track)) continue;
    try {
      return await p.resolve(track);
    } catch (err) {
      first ??= err;
    }
  }
  if (first) throw first instanceof Error ? first : new Error(String(first));
  throw new Error(isTauri() ? "Aucune source audio activée pour ce titre" : "La lecture complète n'existe que dans l'application desktop");
}

/** Background warm-up (next track, hovered row): match + first audio chunk, errors ignored. */
export function prefetchSource(track: Track | undefined) {
  if (track && fullStreamProvider.canPlay(track)) resolveFull(track, "prefetch_stream").catch(() => {});
}
