import { Heart } from "lucide-react";
import type { Track } from "@/types";
import { cn } from "@/lib/cn";
import { toggleFavorite } from "@/store/library";

export function LikeButton({ track, className }: { track: Track; className?: string }) {
  const label = track.favorite ? "Retirer des favoris" : "Ajouter aux favoris";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={track.favorite}
      onClick={() => void toggleFavorite(track.id)}
      className={cn(
        "flex size-7 items-center justify-center rounded-full transition-colors duration-150",
        track.favorite ? "text-accent" : "text-muted hover:text-fg",
        className,
      )}
    >
      <Heart className={cn("size-4", track.favorite && "fill-current")} />
    </button>
  );
}
