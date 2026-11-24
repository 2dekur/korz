import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { api, coverUrl } from "@/services/api";
import { command, usePlayer } from "@/store/player";
import { useUi } from "@/store/ui";
import { Artwork } from "@/components/ui/Artwork";
import { IconButton } from "@/components/ui/IconButton";

export function QueuePanel() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const toggleQueue = useUi((s) => s.toggleQueue);
  return (
    <aside className="flex min-h-0 flex-col border-l border-line bg-bg" aria-label="File d'attente">
      <div className="flex h-14 items-center justify-between px-5">
        <h2 className="font-display text-[15px] font-bold">File d'attente</h2>
        <IconButton label="Fermer la file d'attente" onClick={toggleQueue}>
          <X className="size-4" />
        </IconButton>
      </div>
      {queue.length === 0 ? (
        <p className="px-5 text-[13px] leading-relaxed text-faint">La file est vide. Lancez un titre, un album ou une playlist.</p>
      ) : (
        <ol className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {queue.map((t, i) => (
            <li key={`${t.id}-${i}`}>
              <button
                type="button"
                onClick={() => command(() => api.jump(i))}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-white/[0.045]",
                  index !== null && i < index && "opacity-45",
                )}
              >
                <Artwork src={coverUrl(t.cover)} seed={t.album} className="size-9 rounded-[4px] shadow-none" />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[13px] font-medium", i === index ? "text-accent" : "text-fg")}>{t.title}</span>
                  <span className="block truncate text-[12px] text-muted">{t.artist}</span>
                </span>
                <span className="text-[12px] tabular-nums text-faint">{formatTime(t.durationMs / 1000)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
