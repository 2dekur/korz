import { BadgeCheck } from "lucide-react";
import { Tooltip } from "./Tooltip";

export function ExplicitBadge() {
  return (
    <span
      title="Explicite"
      aria-label="Explicite"
      className="inline-flex size-[15px] shrink-0 items-center justify-center rounded-[3px] bg-white/[0.22] text-[9px] font-bold leading-none text-bg"
    >
      E
    </span>
  );
}

/** Deezer exposes no "verified" flag; the badge marks established artists (100k+ Deezer fans) and says so. */
export const VERIFIED_FANS = 100_000;

export function VerifiedBadge({ fans, className }: { fans?: number; className?: string }) {
  if (!fans || fans < VERIFIED_FANS) return null;
  return (
    <Tooltip label={`${new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(fans)} fans sur Deezer`}>
      <BadgeCheck aria-label="Artiste établi" className={className ?? "size-4 shrink-0 fill-sky-500 text-surface"} />
    </Tooltip>
  );
}
