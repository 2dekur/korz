import { useEffect, useRef } from "react";
import type { Track } from "@/types";
import { prefetchSource } from "@/services/audioProviders";

/** Hover intent (not a fly-over) starts matching the full stream before the click. */
export function useHoverPrefetch() {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (track: Track) => ({
    onPointerEnter: () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => prefetchSource(track), 250);
    },
    onPointerLeave: () => clearTimeout(timer.current),
  });
}

/** Warms the first `count` tracks of a list as soon as it is shown: the likely clicks start instantly. */
export function usePrefetchTracks(tracks: Track[] | undefined, count = 3) {
  const key = tracks?.slice(0, count).map((t) => t.id).join("|") ?? "";
  useEffect(() => {
    tracks?.slice(0, count).forEach((t) => prefetchSource(t));
    // `key` captures the relevant identity of `tracks`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
