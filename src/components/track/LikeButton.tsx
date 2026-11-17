import { CheckCircle2, PlusCircle } from "lucide-react";
import type { Track } from "@/types";
import { cn } from "@/lib/cn";
import { useIsLiked, useLibrary } from "@/store/library";
import { Tooltip } from "@/components/ui/Tooltip";

/** `+` adds to liked tracks; a filled check shows it is liked. */
export function LikeButton({ track, className }: { track: Track; className?: string }) {
  const liked = useIsLiked(track.id);
  const label = liked ? "Retirer des Titres likés" : "Ajouter aux Titres likés";
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={liked}
        onClick={(e) => {
          e.stopPropagation();
          useLibrary.getState().toggleLike(track);
        }}
        className={cn(
          "flex size-7 items-center justify-center rounded-full transition duration-150 active:scale-90",
          liked ? "text-accent" : "text-muted hover:scale-105 hover:text-fg",
          className,
        )}
      >
        {liked ? <CheckCircle2 className="size-[18px] fill-accent text-bg" /> : <PlusCircle className="size-[18px]" />}
      </button>
    </Tooltip>
  );
}
