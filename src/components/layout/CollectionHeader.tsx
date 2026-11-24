import type { ReactNode } from "react";
import { Artwork } from "@/components/ui/Artwork";

/** Album / artist / playlist header: large artwork, kind, title, details, then actions below. */
export function CollectionHeader({ kind, title, cover, seed, round, details, children }: { kind: string; title: ReactNode; cover?: string; seed: string; round?: boolean; details?: ReactNode; children?: ReactNode }) {
  return (
    <header className="pb-8 pt-2">
      <div className="flex items-end gap-7">
        <Artwork src={cover} seed={seed} round={round} className="size-[188px] shadow-[0_18px_48px_rgb(0_0_0/0.5)]" />
        <div className="min-w-0 pb-1">
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">{kind}</div>
          <h1 className="mt-1 line-clamp-2 font-display text-[44px] font-extrabold leading-[1.05] tracking-[-0.03em]">{title}</h1>
          {details && <div className="mt-3 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">{details}</div>}
        </div>
      </div>
      {children && <div className="mt-7 flex items-center gap-3">{children}</div>}
    </header>
  );
}
