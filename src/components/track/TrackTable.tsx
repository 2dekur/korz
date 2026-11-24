import { useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AudioLines, Play } from "lucide-react";
import type { Track } from "@/types";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { coverUrl } from "@/services/api";
import { playTracks, useCurrentTrack, usePlayer } from "@/store/player";
import { useNavigation } from "@/store/navigation";
import { useScrollContainer } from "@/components/layout/ScrollContext";
import { Artwork } from "@/components/ui/Artwork";
import { LikeButton } from "./LikeButton";
import { TrackMenu } from "./TrackMenu";

const ROW_HEIGHT = 52;
const GRID = "grid grid-cols-[36px_minmax(0,1.6fr)_minmax(0,1fr)_64px_52px] items-center gap-4 px-3";

interface TrackTableProps {
  tracks: Track[];
  showAlbum?: boolean;
  /** Album view: number rows by their track number instead of their position. */
  albumNumbers?: boolean;
  onRemove?: (index: number) => void;
}

/** Virtualized against the page scroll container: thousands of rows keep a constant DOM size. */
export function TrackTable({ tracks, showAlbum = true, albumNumbers, onRemove }: TrackTableProps) {
  const scrollRef = useScrollContainer();
  const listRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const current = useCurrentTrack();
  const playing = usePlayer((s) => s.status === "playing");
  const navigate = useNavigation((s) => s.navigate);

  useLayoutEffect(() => {
    const list = listRef.current;
    const scroller = scrollRef.current;
    if (!list || !scroller) return;
    setOffset(list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop);
  }, [scrollRef, tracks]);

  const virtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    scrollMargin: offset,
  });

  return (
    <div role="table" aria-label="Titres" aria-rowcount={tracks.length}>
      <div role="row" className={cn(GRID, "h-9 border-b border-line text-[11px] font-medium uppercase tracking-[0.08em] text-faint")}>
        <span role="columnheader" className="text-right">#</span>
        <span role="columnheader">Titre</span>
        <span role="columnheader">{showAlbum ? "Album" : ""}</span>
        <span role="columnheader" />
        <span role="columnheader" className="text-right">Durée</span>
      </div>
      <div ref={listRef} className="relative mt-1.5" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const track = tracks[item.index]!;
          const active = current?.id === track.id;
          const number = albumNumbers ? (track.trackNo ?? item.index + 1) : item.index + 1;
          return (
            <div
              key={`${track.id}-${item.index}`}
              role="row"
              aria-selected={active}
              onDoubleClick={() => playTracks(tracks, item.index)}
              className={cn(GRID, "group absolute inset-x-0 rounded-md transition-colors duration-100 hover:bg-white/[0.045]", active && "bg-white/[0.035]")}
              style={{ height: ROW_HEIGHT, transform: `translateY(${item.start - offset}px)` }}
            >
              <div role="cell" className="flex justify-end">
                <button
                  type="button"
                  aria-label={`Lire ${track.title}`}
                  onClick={() => playTracks(tracks, item.index)}
                  className="flex size-6 items-center justify-center text-[13px] tabular-nums text-faint"
                >
                  {active && playing ? (
                    <AudioLines className="size-4 text-accent group-hover:hidden" />
                  ) : (
                    <span className={cn("group-hover:hidden", active && "text-accent")}>{number}</span>
                  )}
                  <Play className="hidden size-3.5 fill-fg text-fg group-hover:block" />
                </button>
              </div>
              <div role="cell" className="flex min-w-0 items-center gap-3">
                {showAlbum && <Artwork src={coverUrl(track.cover)} seed={track.album} className="size-9 rounded-[4px] shadow-none" />}
                <div className="min-w-0">
                  <div className={cn("truncate text-[14px] font-medium", active ? "text-accent" : "text-fg")}>{track.title}</div>
                  <button
                    type="button"
                    onClick={() => navigate({ name: "artist", artist: track.artist })}
                    className="block max-w-full truncate text-[12.5px] text-muted transition-colors hover:text-fg hover:underline"
                  >
                    {track.artist}
                  </button>
                </div>
              </div>
              <div role="cell" className="min-w-0 truncate text-[13px] text-muted">
                {showAlbum && (
                  <button
                    type="button"
                    onClick={() => navigate({ name: "album", title: track.album, artist: track.albumArtist })}
                    className="max-w-full truncate transition-colors hover:text-fg hover:underline"
                  >
                    {track.album}
                  </button>
                )}
              </div>
              <div role="cell" className="flex items-center justify-end gap-0.5">
                <LikeButton track={track} className={cn(!track.favorite && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100")} />
                <TrackMenu
                  track={track}
                  onRemove={onRemove && (() => onRemove(item.index))}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                />
              </div>
              <div role="cell" className="text-right text-[13px] tabular-nums text-faint">
                {formatTime(track.durationMs / 1000)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
