import { create } from "zustand";
import { toast } from "sonner";
import type { Track } from "@/types";
import { audio } from "@/services/audio";
import { readKey, writeKey } from "@/services/persist";
import { candidateProviders, prefetchSource, type AudioProvider } from "@/services/audioProviders";

export type RepeatMode = "off" | "all" | "one";

interface PlayerState {
  queue: Track[];
  index: number;
  isPlaying: boolean;
  /** A full stream is being matched/fetched for the current track. */
  resolving: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Durations learned from loaded metadata for tracks whose length was unknown (local files). */
  durations: Record<string, number>;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  /** Appends to the queue (starts playback if nothing is loaded). */
  enqueue: (track: Track) => void;
  jumpTo: (index: number) => void;
  removeAt: (index: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
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

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// --- source fallback ----------------------------------------------------------------------
// Each load walks the providers in order (local → full stream → 30 s preview as last resort). A provider that
// fails to resolve, or whose audio errors before the first `playing` event, hands over to the next one.

let token = 0;
let remaining: AudioProvider[] = [];
let started = false;
let firstError: unknown;

async function tryNextSource(track: Track, mine: number): Promise<void> {
  while (remaining.length) {
    const provider = remaining.shift()!;
    try {
      const src = await provider.resolve(track);
      if (mine !== token) return; // a newer track was requested meanwhile
      audio.src = src;
      void play();
      return;
    } catch (err) {
      if (mine !== token) return;
      firstError ??= err;
    }
  }
  if (mine !== token) return;
  usePlayer.setState({ resolving: false, isPlaying: false });
  console.error(firstError);
  toast.error(`« ${track.title} » est introuvable`, {
    description: firstError instanceof Error ? firstError.message : String(firstError ?? "Aucune source audio activée"),
  });
}

async function load(index: number) {
  const track = usePlayer.getState().queue[index];
  if (!track) return;
  const mine = ++token;
  remaining = candidateProviders(track);
  started = false;
  firstError = undefined;
  audio.pause();
  usePlayer.setState({ index, position: 0, duration: 0, resolving: true });
  await tryNextSource(track, mine);
}

export const usePlayer = create<PlayerState>((set, get) => {
  /** Unshuffled order, restored when shuffle is turned off. */
  let original: Track[] = [];

  return {
    queue: [],
    index: -1,
    isPlaying: false,
    resolving: false,
    position: 0,
    duration: 0,
    volume: 0.8,
    muted: false,
    shuffle: false,
    repeat: "off",
    durations: {},

    playQueue: (tracks, startIndex = 0) => {
      const start = tracks[startIndex];
      if (!start) return;
      const current = get().queue[get().index];
      original = tracks;
      if (get().shuffle) {
        set({ queue: [start, ...shuffled(tracks.filter((_, i) => i !== startIndex))] });
        if (current?.id === start.id) set({ index: 0 });
        else void load(0);
        return;
      }
      if (current?.id === start.id) {
        set({ queue: tracks, index: startIndex });
        get().toggle();
        return;
      }
      set({ queue: tracks });
      void load(startIndex);
    },

    enqueue: (track) => {
      if (get().index < 0) return get().playQueue([track], 0);
      original = [...original, track];
      set({ queue: [...get().queue, track] });
      toast("Ajouté à la file d'attente", { description: track.title });
    },

    jumpTo: (index) => void load(index),

    removeAt: (index) => {
      const { queue, index: current } = get();
      if (index === current || !queue[index]) return;
      const removed = queue[index]!;
      original = original.filter((t) => t !== removed);
      set({ queue: queue.filter((_, i) => i !== index), index: index < current ? current - 1 : current });
    },

    toggleShuffle: () => {
      const { queue, index, shuffle } = get();
      const current = queue[index];
      if (shuffle) {
        const restored = original.length ? original : queue;
        set({ shuffle: false, queue: restored, index: Math.max(0, restored.findIndex((t) => t === current)) });
      } else {
        original = queue;
        set({ shuffle: true, queue: [...queue.slice(0, index + 1), ...shuffled(queue.slice(index + 1))] });
      }
    },

    cycleRepeat: () => set({ repeat: get().repeat === "off" ? "all" : get().repeat === "all" ? "one" : "off" }),

    toggle: () => {
      if (get().index < 0) return;
      if (audio.paused) void play();
      else audio.pause();
    },

    next: () => {
      const { index, queue, repeat } = get();
      if (index < queue.length - 1) void load(index + 1);
      else if (repeat === "all" && queue.length) void load(0);
      else {
        audio.pause();
        audio.currentTime = 0;
      }
    },

    prev: () => {
      const { index } = get();
      if (audio.currentTime > 3 || index <= 0) audio.currentTime = 0;
      else void load(index - 1);
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

audio.addEventListener("playing", () => {
  started = true;
  usePlayer.setState({ resolving: false });
});
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
  usePlayer.setState({ duration: audio.duration });
  // Previews are 30 s: only unknown (local) lengths are learned from the file.
  if (!track.duration) usePlayer.setState({ durations: { ...durations, [track.id]: audio.duration } });
});
audio.addEventListener("ended", () => {
  if (usePlayer.getState().repeat === "one") {
    audio.currentTime = 0;
    void play();
  } else usePlayer.getState().next();
});
audio.addEventListener("error", () => {
  if (!audio.getAttribute("src")) return;
  const { queue, index } = usePlayer.getState();
  const track = queue[index];
  const code = audio.error?.code;
  console.error("audio element error", code, audio.error?.message);
  // Failed before a single sample played: hand over to the next source right away.
  if (track && !started && remaining.length) {
    firstError ??= new Error(`flux illisible (code ${code ?? "?"})`);
    void tryNextSource(track, token);
    return;
  }
  usePlayer.setState({ isPlaying: false, resolving: false });
  toast.error("Lecture interrompue", {
    description: track ? `« ${track.title} » : flux illisible (code ${code ?? "?"}).` : undefined,
  });
});

// Whatever changes what comes next (new track, shuffle, enqueue, removal), warm it so "next" starts at once.
usePlayer.subscribe((s, prev) => {
  if (s.queue === prev.queue && s.index === prev.index) return;
  const next = s.queue[s.index + 1];
  if (next && next !== prev.queue[prev.index + 1]) prefetchSource(next);
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
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album?.title ?? "",
      artwork: track.coverLarge ? [{ src: track.coverLarge, sizes: "1000x1000", type: "image/jpeg" }] : [],
    });
  });
}

export const useCurrentTrack = () => usePlayer((s) => s.queue[s.index]);
