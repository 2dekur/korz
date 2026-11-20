import { useEffect } from "react";
import { create } from "zustand";
import type { Track } from "@/types";
import { fetchLyrics, translateToFrench, type Lyrics, type Translation } from "@/services/lyrics";
import { readKey, writeKey } from "@/services/persist";

type Entry<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; error: string };

/** Persisted translations are capped so the store file stays small. */
const MAX_SAVED_TRANSLATIONS = 300;

interface LyricsState {
  lyrics: Record<string, Entry<Lyrics>>;
  translations: Record<string, Entry<Translation>>;
}

export const useLyricsStore = create<LyricsState>(() => ({ lyrics: {}, translations: {} }));

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

function persistTranslations() {
  const ready = Object.entries(useLyricsStore.getState().translations).flatMap(([k, e]) =>
    e.status === "ready" ? [[k, e.data] as const] : [],
  );
  void writeKey("lyricsTranslations", Object.fromEntries(ready.slice(-MAX_SAVED_TRANSLATIONS)));
}

export async function hydrateTranslations() {
  const saved = await readKey<Record<string, Translation>>("lyricsTranslations");
  if (!saved || typeof saved !== "object") return;
  const translations: Record<string, Entry<Translation>> = {};
  for (const [k, v] of Object.entries(saved)) {
    if (v && Array.isArray(v.lines) && typeof v.alreadyFrench === "boolean") translations[k] = { status: "ready", data: v };
  }
  useLyricsStore.setState({ translations });
}

export function useLyrics(track: Track | undefined, duration: number) {
  const id = track?.id;
  useEffect(() => {
    if (!track || !id) return;
    const current = useLyricsStore.getState().lyrics[id];
    if (current && current.status !== "error") return;
    const put = (e: Entry<Lyrics>) => useLyricsStore.setState((s) => ({ lyrics: { ...s.lyrics, [id]: e } }));
    put({ status: "loading" });
    fetchLyrics(track, track.duration || duration).then(
      (data) => put({ status: "ready", data }),
      (err) => put({ status: "error", error: message(err) }),
    );
    // Duration only matters for local files whose length is learned after load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, track?.duration || Math.round(duration)]);
  return useLyricsStore((s) => (id ? s.lyrics[id] : undefined));
}

export function useTranslation(trackId: string | undefined, lines: string[] | undefined, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !trackId || !lines?.length) return;
    const current = useLyricsStore.getState().translations[trackId];
    if (current && current.status !== "error") return;
    const put = (e: Entry<Translation>) => useLyricsStore.setState((s) => ({ translations: { ...s.translations, [trackId]: e } }));
    put({ status: "loading" });
    translateToFrench(lines).then(
      (data) => {
        put({ status: "ready", data });
        persistTranslations();
      },
      (err) => put({ status: "error", error: message(err) }),
    );
  }, [trackId, lines, enabled]);
  return useLyricsStore((s) => (trackId && enabled ? s.translations[trackId] : undefined));
}
