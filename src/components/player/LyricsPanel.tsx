import { useEffect, useMemo, useRef } from "react";
import { Languages, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { activeLineIndex } from "@/services/lyrics";
import { usePlayer, useCurrentTrack } from "@/store/player";
import { useSettings } from "@/store/settings";
import { useUi } from "@/store/ui";
import { useLyrics, useTranslation } from "@/store/lyrics";
import { IconButton } from "@/components/ui/IconButton";
import { Switch } from "@/components/ui/Switch";

/** Lines are highlighted slightly early: the eye reads ahead of the voice. */
const LEAD_SECONDS = 0.25;
/** Manual scrolling pauses auto-follow for this long. */
const FOLLOW_PAUSE_MS = 3000;

export function LyricsPanel() {
  const track = useCurrentTrack();
  const duration = usePlayer((s) => s.duration);
  const seek = usePlayer((s) => s.seek);
  const translate = useSettings((s) => s.lyricsTranslate);
  const entry = useLyrics(track, duration);
  const lyrics = entry?.status === "ready" ? entry.data : undefined;
  const lines = lyrics && (lyrics.kind === "synced" || lyrics.kind === "plain") ? lyrics.lines : undefined;
  const texts = useMemo(() => lines?.map((l) => l.text), [lines]);
  const translation = useTranslation(track?.id, texts, translate);
  const synced = lyrics?.kind === "synced";
  // Re-renders only when the active line changes, not on every animation frame.
  const active = usePlayer((s) => (synced && lines ? activeLineIndex(lines, s.position + LEAD_SECONDS) : -1));

  const listRef = useRef<HTMLDivElement>(null);
  const pausedUntil = useRef(0);
  useEffect(() => {
    if (active < 0 || Date.now() < pausedUntil.current) return;
    listRef.current?.querySelector<HTMLElement>(`[data-line="${active}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active]);

  const fr = translation?.status === "ready" && !translation.data.alreadyFrench ? translation.data.lines : undefined;

  return (
    <aside className="row-span-1 flex min-h-0 w-[380px] flex-col border-l border-line bg-bg" aria-label="Paroles">
      <div className="flex h-16 items-center justify-between gap-3 px-5">
        <h2 className="font-display text-[16px] font-bold">Paroles</h2>
        <div className="flex items-center gap-3">
          <label htmlFor="lyrics-fr" className="flex items-center gap-2 text-[12px] text-muted">
            <Languages className="size-4" />
            Traduire en français
          </label>
          <Switch id="lyrics-fr" checked={translate} onCheckedChange={(v) => useSettings.getState().update({ lyricsTranslate: v })} />
          <IconButton label="Fermer les paroles" onClick={() => useUi.getState().togglePanel("lyrics")}>
            <X className="size-4" />
          </IconButton>
        </div>
      </div>

      {translate && translation && (
        <div className="px-5 pb-2 text-[11px] text-faint" role="status">
          {translation.status === "loading" && (
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3 animate-spin" /> Traduction…
            </span>
          )}
          {translation.status === "error" && `Traduction indisponible : ${translation.error}`}
          {translation.status === "ready" && translation.data.alreadyFrench && "Paroles déjà en français."}
        </div>
      )}

      <div
        ref={listRef}
        onWheel={() => (pausedUntil.current = Date.now() + FOLLOW_PAUSE_MS)}
        className="min-h-0 flex-1 overflow-y-auto px-5 pb-[40vh] pt-4 [mask-image:linear-gradient(to_bottom,transparent,black_6%,black_88%,transparent)]"
      >
        {!track ? (
          <Empty>Lancez un titre pour afficher ses paroles.</Empty>
        ) : !entry || entry.status === "loading" ? (
          <Empty>
            <Loader2 className="mr-2 inline size-4 animate-spin" />
            Recherche des paroles…
          </Empty>
        ) : entry.status === "error" ? (
          <Empty>Paroles injoignables pour le moment.</Empty>
        ) : lyrics?.kind === "instrumental" ? (
          <Empty>Titre instrumental.</Empty>
        ) : !lines?.length ? (
          <Empty>Pas de paroles disponibles pour ce titre.</Empty>
        ) : (
          <>
            {!synced && <p className="mb-4 text-[11px] uppercase tracking-[0.08em] text-faint">Paroles non synchronisées</p>}
            {lines.map((line, i) => {
              const state = !synced ? "plain" : i === active ? "active" : i < active ? "past" : "future";
              const clickable = synced && line.time !== null;
              return (
                <div
                  key={i}
                  data-line={i}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => seek(line.time!) : undefined}
                  onKeyDown={clickable ? (e) => e.key === "Enter" && seek(line.time!) : undefined}
                  className={cn(
                    "rounded-md py-1.5 font-display transition-[color,opacity] duration-300",
                    clickable && "-mx-2 cursor-default px-2 hover:bg-white/[0.04]",
                    line.text ? "text-[20px] font-bold leading-snug tracking-[-0.01em]" : "h-4",
                    state === "active" && "text-fg",
                    state === "past" && "text-muted/70",
                    state === "future" && "text-faint",
                    state === "plain" && "text-[17px] font-semibold text-fg/90",
                  )}
                >
                  {line.text || (synced ? "♪" : "")}
                  {fr?.[i] && <div className="mt-0.5 font-sans text-[13px] font-normal leading-snug text-muted/75">{fr[i]}</div>}
                </div>
              );
            })}
            <p className="mt-10 text-[11px] text-faint">Paroles : LRCLIB{fr ? " · Traduction : MyMemory" : ""}</p>
          </>
        )}
      </div>
    </aside>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="pt-10 text-center text-[14px] text-muted">{children}</p>;
}
