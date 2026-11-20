import { X } from "lucide-react";
import type { Track } from "@/types";
import { cn } from "@/lib/cn";
import { usePlayer } from "@/store/player";
import { useUi } from "@/store/ui";
import { Artwork } from "@/components/ui/Artwork";
import { IconButton } from "@/components/ui/IconButton";
import { ArtistLinks } from "@/components/track/ArtistLinks";

/** Upcoming items rendered at once; a queue built from a large local library can hold thousands. */
const VISIBLE_UPCOMING = 100;

export function QueuePanel() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const { jumpTo, removeAt } = usePlayer.getState();
  const current = queue[index];
  const upcoming = queue.slice(index + 1);

  return (
    <aside className="row-span-1 flex min-h-0 w-[340px] flex-col border-l border-line bg-bg" aria-label="File d'attente">
      <div className="flex h-16 items-center justify-between px-5">
        <h2 className="font-display text-[16px] font-bold">File d'attente</h2>
        <IconButton label="Fermer la file d'attente" onClick={() => useUi.getState().togglePanel("queue")}>
          <X className="size-4" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        <Label>En cours</Label>
        {current ? <Row track={current} active /> : <p className="px-2 text-[13px] text-faint">Rien en lecture.</p>}
        <Label>À suivre</Label>
        {upcoming.length === 0 && <p className="px-2 text-[13px] text-faint">La file est vide.</p>}
        {upcoming.slice(0, VISIBLE_UPCOMING).map((t, i) => (
          <Row key={`${t.id}-${index + 1 + i}`} track={t} onPlay={() => jumpTo(index + 1 + i)} onRemove={() => removeAt(index + 1 + i)} />
        ))}
        {upcoming.length > VISIBLE_UPCOMING && (
          <p className="px-2 pt-2 text-[12px] text-faint">+ {upcoming.length - VISIBLE_UPCOMING} autres titres</p>
        )}
      </div>
    </aside>
  );
}

function Label({ children }: { children: string }) {
  return <div className="px-2 pb-1.5 pt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{children}</div>;
}

function Row({ track, active, onPlay, onRemove }: { track: Track; active?: boolean; onPlay?: () => void; onRemove?: () => void }) {
  return (
    <div
      role={onPlay ? "button" : undefined}
      tabIndex={onPlay ? 0 : undefined}
      onClick={onPlay}
      onKeyDown={(e) => e.key === "Enter" && onPlay?.()}
      className={cn("group flex h-14 items-center gap-3 rounded-md px-2", onPlay && "hover:bg-white/[0.05]")}
    >
      <Artwork src={track.cover} seed={track.id} className="size-10 rounded-[4px] shadow-none" />
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[14px] font-medium", active ? "text-accent" : "text-fg")}>{track.title}</div>
        <ArtistLinks artists={track.artists} className="text-[12px]" />
      </div>
      {onRemove && (
        <IconButton
          label={`Retirer ${track.title} de la file`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <X className="size-4" />
        </IconButton>
      )}
    </div>
  );
}
