import { create } from "zustand";
import { toast } from "sonner";
import type { Track } from "@/types";
import { audio } from "@/services/audio";
import { readKey, writeKey } from "@/services/persist";
import { getArtist } from "@/services/catalog";

interface PlayerState {
  queue: Track[];
  index: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  /** Durations learned from loaded metadata, keyed by track id. */
  durations: Record<string, number>;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  hydrate: () => Promise<void>;
}

const play = () =>
  audio.play().catch((err: unknown) => {
    // AbortError = a newer src replaced this one before playback started; expected on fast skipping.
    if (err instanceof DOMException && err.name === "AbortError") return;
    console.error(err);
  });

export const usePlayer = create<PlayerState>((set, get) => {
  const load = (index: number) => {
    const track = get().queue[index];
    if (!track) return;
    set({ index, position: 0, duration: get().durations[track.id] ?? 0 });
    audio.src = track.src;
    void play();
  };

  return {
    queue: [],
    index: -1,
    isPlaying: false,
    position: 0,
    duration: 0,
    volume: 0.8,
    muted: false,
    durations: {},
    playQueue: (tracks, startIndex = 0) => {
      const current = get().queue[get().index];
      if (current && current.id === tracks[startIndex]?.id) {
        set({ queue: tracks, index: startIndex });
        get().toggle();
        return;
      }
      set({ queue: tracks });
      load(startIndex);
    },
    toggle: () => {
      if (get().index < 0) return;
      if (audio.paused) void play();
      else audio.pause();
    },
    next: () => {
      const { index, queue } = get();
      if (index < queue.length - 1) load(index + 1);
      else {
        audio.pause();
        audio.currentTime = 0;
      }
    },
    prev: () => {
      const { index } = get();
      if (audio.currentTime > 3 || index <= 0) audio.currentTime = 0;
      else load(index - 1);
    },
    seek: (seconds) => {
      audio.currentTime = seconds;
      set({ position: seconds });
    },
    setVolume: (volume) => {
      audio.volume = volume;
      set({ volume, muted: volume === 0 ? get().muted : false });
      audio.muted = get().muted;
    },
    toggleMute: () => {
      audio.muted = !get().muted;
      set({ muted: audio.muted });
    },
    hydrate: async () => {
      const v = await readKey<number>("volume");
      if (typeof v === "number" && v >= 0 && v <= 1) get().setVolume(v);
      else audio.volume = get().volume;
    },
  };
});

// --- audio element -> store -------------------------------------------------------------

let frame = 0;
const tick = () => {
  usePlayer.setState({ position: audio.currentTime });
  frame = requestAnimationFrame(tick);
};

audio.addEventListener("play", () => {
  usePlayer.setState({ isPlaying: true });
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(tick);
});
audio.addEventListener("pause", () => {
  usePlayer.setState({ isPlaying: false, position: audio.currentTime });
  cancelAnimationFrame(frame);
});
audio.addEventListener("loadedmetadata", () => {
  const { queue, index, durations } = usePlayer.getState();
  const track = queue[index];
  if (!track) return;
  usePlayer.setState({ duration: audio.duration, durations: { ...durations, [track.id]: audio.duration } });
});
audio.addEventListener("ended", () => usePlayer.getState().next());
audio.addEventListener("error", () => {
  const track = usePlayer.getState().queue[usePlayer.getState().index];
  usePlayer.setState({ isPlaying: false });
  toast.error("Lecture impossible", { description: track ? `« ${track.title} » est indisponible.` : undefined });
});

// Persist volume, debounced so dragging the slider does not spam the store.
let volumeTimer: ReturnType<typeof setTimeout> | undefined;
usePlayer.subscribe((s, prev) => {
  if (s.volume === prev.volume) return;
  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(() => void writeKey("volume", s.volume), 300);
});

// OS media keys / Windows media overlay.
if ("mediaSession" in navigator) {
  const ms = navigator.mediaSession;
  ms.setActionHandler("play", () => usePlayer.getState().toggle());
  ms.setActionHandler("pause", () => usePlayer.getState().toggle());
  ms.setActionHandler("nexttrack", () => usePlayer.getState().next());
  ms.setActionHandler("previoustrack", () => usePlayer.getState().prev());
  usePlayer.subscribe((s, prev) => {
    const track = s.queue[s.index];
    if (!track || track === prev.queue[prev.index]) return;
    ms.metadata = new MediaMetadata({
      title: track.title,
      artist: getArtist(track.artistId)?.name ?? "",
      album: track.album,
    });
  });
}

export const useCurrentTrack = () => usePlayer((s) => s.queue[s.index]);
