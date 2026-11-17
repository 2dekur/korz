import type { Artist } from "@/types";
import { cn } from "@/lib/cn";
import { useIsFollowed, useLibrary } from "@/store/library";

export function FollowButton({ artist, className }: { artist: Artist; className?: string }) {
  const followed = useIsFollowed(artist.id);
  return (
    <button
      type="button"
      aria-pressed={followed}
      onClick={(e) => {
        e.stopPropagation();
        useLibrary.getState().toggleFollow(artist);
      }}
      className={cn(
        "h-8 shrink-0 rounded-full px-4 text-[13px] font-semibold ring-1 transition duration-150 hover:scale-[1.03] active:scale-95",
        followed ? "text-fg ring-white/40 hover:ring-white/60" : "text-fg ring-white/20 hover:ring-white/50",
        className,
      )}
    >
      {followed ? "Abonné" : "S'abonner"}
    </button>
  );
}
