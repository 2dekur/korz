import { create } from "zustand";
import { toast } from "sonner";
import { api, errorMessage, events } from "@/services/api";
import type { PlayerState, Track } from "@/types";
import { useLibrary } from "./library";

interface PlayerStore extends PlayerState {
  positionMs: number;
  durationMs: number;
}

/** Read-only mirror of the Rust audio engine; it changes only through engine events. */
export const usePlayer = create<PlayerStore>(() => ({
  status: "idle",
  queue: [],
  index: null,
  volume: 1,
  error: null,
  positionMs: 0,
  durationMs: 0,
}));

export const useCurrentTrack = () => usePlayer((s) => (s.index === null ? undefined : s.queue[s.index]));

export async function initPlayer() {
  await events.playerState((s) => {
    const prevError = usePlayer.getState().error;
    usePlayer.setState(s);
    if (s.error && s.error !== prevError) toast.error("Lecture impossible", { description: s.error });
    // History changed: home/recent views refresh.
    if (s.status === "playing") useLibrary.getState().bump();
  });
  await events.playerPosition((p) => usePlayer.setState(p));
  usePlayer.setState(await api.playerState());
}

/** Wraps a player command so a failure is reported instead of silently ignored. */
export function command(run: () => Promise<void>) {
  run().catch((err) => toast.error("Commande refusée", { description: errorMessage(err) }));
}

export const playTracks = (tracks: Track[], index: number) =>
  command(() => api.play(tracks.map((t) => t.id), index));
