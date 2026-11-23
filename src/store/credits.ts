import { useEffect } from "react";
import { create } from "zustand";
import type { ArtistRef, Track } from "@/types";
import { allArtists } from "@/lib/music";
import { getTrackCredits } from "@/services/musicApi";
import { readKey, writeKey } from "@/services/persist";

/**
 * Deezer search/album/chart results only name the main artist; the full credits (featurings) live on
 * /track/{id}. They are fetched for tracks actually on screen, throttled, and persisted.
 */
const useCredits = create<{ byId: Record<string, ArtistRef[]> }>(() => ({ byId: {} }));

const MAX_SAVED = 3000;
const CONCURRENCY = 3;
/** Stays well under Deezer's 50 requests / 5 s alongside search and pages. */
const SPACING_MS = 150;

const queued: Track[] = [];
const seen = new Set<string>();
let running = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function pump() {
  while (running < CONCURRENCY && queued.length) {
    const track = queued.shift()!;
    running++;
    getTrackCredits(track.id)
      .then((artists) => {
        if (artists.length) useCredits.setState((s) => ({ byId: { ...s.byId, [track.id]: artists } }));
      })
      .catch(() => seen.delete(track.id)) // retried next time it is shown
      .finally(() => setTimeout(() => {
        running--;
        pump();
      }, SPACING_MS));
  }
}

function want(track: Track) {
  if (track.source !== "deezer" || track.credited || seen.has(track.id)) return;
  seen.add(track.id);
  queued.push(track);
  pump();
}

useCredits.subscribe((s) => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const entries = Object.entries(s.byId);
    void writeKey("credits", Object.fromEntries(entries.slice(-MAX_SAVED)));
  }, 1000);
});

export async function hydrateCredits() {
  const saved = await readKey<Record<string, ArtistRef[]>>("credits");
  if (!saved || typeof saved !== "object") return;
  const byId: Record<string, ArtistRef[]> = {};
  for (const [id, list] of Object.entries(saved)) {
    if (Array.isArray(list) && list.every((a) => a && typeof a.name === "string")) {
      byId[id] = list;
      seen.add(id);
    }
  }
  useCredits.setState({ byId });
}

/** Every artist of a track (credits + featurings from the title); fetches missing credits in the background. */
export function useTrackArtists(track: Track): ArtistRef[] {
  useEffect(() => want(track), [track]);
  const credits = useCredits((s) => s.byId[track.id]);
  return allArtists(track, credits);
}

/** Non-hook access (media session, stream matching). */
export const trackArtists = (track: Track) => allArtists(track, useCredits.getState().byId[track.id]);
