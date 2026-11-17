import type { HTMLAttributes } from "react";
import { AudioLines } from "lucide-react";
import type { Track } from "@/types";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { useCurrentTrack, usePlayer } from "@/store/player";
import { Artwork } from "@/components/ui/Artwork";
import { ExplicitBadge } from "@/components/ui/Badges";
import { ArtistLinks } from "./ArtistLinks";
import { LikeButton } from "./LikeButton";
import { useHoverPrefetch } from "@/hooks/useHoverPrefetch";

type Props = HTMLAttributes<HTMLDivElement> & { track: Track; active?: boolean };

/** Cover + title + artists + like + duration: search dropdown and search "Titres" block. */
export function CompactTrackRow({ track, active, className, ...props }: Props) {
  const current = useCurrentTrack()?.id === track.id;
  const playing = usePlayer((s) => s.isPlaying) && current;
  const hover = useHoverPrefetch();
  return (
    <div
      {...hover(track)}
      {...props}
      className={cn(
        "group flex h-14 cursor-default items-center gap-3 rounded-md px-2 transition-colors duration-100 hover:bg-white/[0.06]",
        active && "bg-white/[0.08]",
        className,
      )}
    >
      <div className="relative">
        <Artwork src={track.cover} seed={track.id} className="size-10 rounded-[4px] shadow-none" />
        {playing && (
          <span className="absolute inset-0 flex items-center justify-center rounded-[4px] bg-black/50">
            <AudioLines className="size-4 text-accent" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("truncate text-[14px] font-medium", current ? "text-accent" : "text-fg")}>{track.title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {track.explicit && <ExplicitBadge />}
          <ArtistLinks artists={track.artists} />
        </div>
      </div>
      <LikeButton track={track} className="opacity-0 group-hover:opacity-100 aria-pressed:opacity-100" />
      <span className="w-10 text-right text-[13px] tabular-nums text-faint">{formatTime(track.duration || NaN)}</span>
    </div>
  );
}
