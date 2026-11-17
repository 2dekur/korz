import { useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AudioLines, Play } from "lucide-react";
import type { Track } from "@/types";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { getArtist } from "@/services/catalog";
import { usePlayer, useCurrentTrack } from "@/store/player";
import { useNavigation } from "@/store/navigation";
import { useScrollContainer } from "@/components/layout/ScrollContext";
import { Artwork } from "@/components/ui/Artwork";

const ROW_HEIGHT = 56;
const GRID = "grid grid-cols-[36px_minmax(0,1.4fr)_minmax(0,1fr)_56px] items-center gap-4 px-4";

/** Virtualized against the page scroll container: thousands of rows keep a constant DOM size. */
export function TrackList({ tracks, showAlbum = true }: { tracks: Track[]; showAlbum?: boolean }) {
  const scrollRef = useScrollContainer();
  const listRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const current = useCurrentTrack();
  const isPlaying = usePlayer((s) => s.isPlaying);
  const durations = usePlayer((s) => s.durations);
  const playQueue = usePlayer((s) => s.playQueue);
  const navigate = useNavigation((s) => s.navigate);

  useLayoutEffect(() => {
    const list = listRef.current;
    const scroller = scrollRef.current;
    if (!list || !scroller) return;
    setOffset(list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop);
    // Re-measured when tracks change: content above the list (e.g. search artists) changes with it.
  }, [scrollRef, tracks]);

  const virtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    scrollMargin: offset,
  });

  return (
    <div role="table" aria-label="Titres">
      <div role="row" className={cn(GRID, "h-9 border-b border-line text-[11px] font-medium uppercase tracking-[0.08em] text-faint")}>
        <span role="columnheader" className="text-right">#</span>
        <span role="columnheader">Titre</span>
        <span role="columnheader">{showAlbum ? "Album" : ""}</span>
        <span role="columnheader" className="text-right">Durée</span>
      </div>
      <div ref={listRef} className="relative mt-2" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const track = tracks[item.index]!;
          const active = current?.id === track.id;
          const artist = getArtist(track.artistId);
          return (
            <div
              key={track.id}
              role="row"
              aria-selected={active}
              onDoubleClick={() => playQueue(tracks, item.index)}
              className={cn(GRID, "group absolute inset-x-0 rounded-md transition-colors duration-100 hover:bg-white/[0.045]", active && "bg-white/[0.035]")}
              style={{ height: ROW_HEIGHT, transform: `translateY(${item.start - offset}px)` }}
            >
              <div role="cell" className="flex justify-end">
                <button
                  type="button"
                  aria-label={`Lire ${track.title}`}
                  onClick={() => playQueue(tracks, item.index)}
                  className="flex size-6 items-center justify-center text-[13px] tabular-nums text-faint"
                >
                  {active && isPlaying ? (
                    <AudioLines className="size-4 text-accent group-hover:hidden" />
                  ) : (
                    <span className={cn("group-hover:hidden", active && "text-accent")}>{item.index + 1}</span>
                  )}
                  <Play className="hidden size-3.5 fill-fg text-fg group-hover:block" />
                </button>
              </div>
              <div role="cell" className="flex min-w-0 items-center gap-3">
                <Artwork hue={track.hue} className="size-10 rounded-[4px] shadow-none" />
                <div className="min-w-0">
                  <div className={cn("truncate text-[14px] font-medium", active ? "text-accent" : "text-fg")}>{track.title}</div>
                  {artist && (
                    <button
                      type="button"
                      onClick={() => navigate({ name: "artist", id: artist.id })}
                      className="truncate text-[13px] text-muted transition-colors hover:text-fg hover:underline"
                    >
                      {artist.name}
                    </button>
                  )}
                </div>
              </div>
              <div role="cell" className="truncate text-[13px] text-muted">{showAlbum ? track.album : ""}</div>
              <div role="cell" className="text-right text-[13px] tabular-nums text-faint">
                {formatTime(durations[track.id] ?? NaN)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
