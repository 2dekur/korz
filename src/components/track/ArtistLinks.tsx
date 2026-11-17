import { Fragment } from "react";
import type { ArtistRef } from "@/types";
import { cn } from "@/lib/cn";
import { useNavigation } from "@/store/navigation";
import { prefetchArtist } from "@/store/catalog";

/** Comma-separated artist names; linked ones open the artist view and prefetch it on hover. */
export function ArtistLinks({ artists, className }: { artists: ArtistRef[]; className?: string }) {
  const navigate = useNavigation((s) => s.navigate);
  return (
    <span className={cn("block truncate text-[13px] text-muted", className)}>
      {artists.map((a, i) => (
        <Fragment key={`${a.id ?? a.name}-${i}`}>
          {i > 0 && ", "}
          {a.id ? (
            <button
              type="button"
              onPointerEnter={() => prefetchArtist(a.id!)}
              onClick={(e) => {
                e.stopPropagation();
                navigate({ name: "artist", id: a.id! });
              }}
              className="transition-colors hover:text-fg hover:underline"
            >
              {a.name}
            </button>
          ) : (
            a.name
          )}
        </Fragment>
      ))}
    </span>
  );
}
