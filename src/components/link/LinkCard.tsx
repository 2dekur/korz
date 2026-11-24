import { useEffect, useRef } from "react";
import { Download, ExternalLink, ListEnd, Loader2, Play, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import type { Confidence, LinkResolution } from "@/types";
import { cn } from "@/lib/cn";
import { errorMessage, coverUrl } from "@/services/api";
import { act, closeLink, useSmartLink } from "@/store/smartlink";
import { Artwork } from "@/components/ui/Artwork";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

const SOURCE: Record<LinkResolution["source"], string> = {
  direct_audio: "Lien direct",
  youtube: "YouTube",
  spotify: "Spotify",
  unsupported: "Non pris en charge",
};

const CONFIDENCE: Record<Confidence, { label: string; className: string }> = {
  high: { label: "Correspondance sûre", className: "bg-accent/15 text-accent" },
  medium: { label: "Probable", className: "bg-amber-400/15 text-amber-300" },
  low: { label: "Incertaine", className: "bg-white/[0.08] text-muted" },
};

const sizeLabel = (bytes: number | null) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : null);

export function LinkCard() {
  const r = useSmartLink((s) => s.current);
  if (!r) return null;
  return <Card r={r} />;
}

function Card({ r }: { r: LinkResolution }) {
  const selected = useSmartLink((s) => s.selected);
  const busy = useSmartLink((s) => s.busy);
  const panel = useRef<HTMLDivElement>(null);
  const chosen = r.candidates[selected];
  const local = r.candidates.filter((c) => c.kind === "local");
  const shown = chosen?.track;
  const artwork = r.meta.artworkUrl ?? coverUrl(shown?.cover ?? null);
  const title = r.meta.title ?? shown?.title ?? "Lien";
  const subtitle = r.meta.artist ?? (r.source === "direct_audio" ? null : shown?.artist);
  const details = [r.meta.format, sizeLabel(r.meta.sizeBytes)].filter(Boolean).join(" · ");
  const canPlay = !!chosen && !busy;

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && closeLink();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, r]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[3px] animate-[fade-in_120ms_ease-out]"
      onPointerDown={(e) => e.target === e.currentTarget && !busy && closeLink()}
    >
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="link-card-title" className="w-[540px] max-w-full rounded-2xl bg-raised p-6 shadow-[0_24px_64px_rgb(0_0_0/0.6)] ring-1 ring-white/10">
        <div className="flex items-start gap-5">
          <Artwork src={artwork ?? undefined} seed={title} className="size-24 rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[11px] font-semibold text-fg">{r.provider ?? SOURCE[r.source]}</span>
              {details && <span className="text-[11.5px] font-medium text-faint">{details}</span>}
            </div>
            <h2 id="link-card-title" className="mt-2 line-clamp-2 font-display text-[19px] font-bold leading-tight tracking-[-0.01em]">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</p>}
          </div>
          <IconButton label="Fermer" onClick={closeLink} disabled={!!busy} className="-mr-2 -mt-2 shrink-0">
            <X className="size-4" />
          </IconButton>
        </div>

        {r.message && <p className="mt-5 rounded-lg bg-white/[0.04] px-3.5 py-2.5 text-[13px] leading-relaxed text-muted">{r.message}</p>}

        {r.source === "direct_audio" && chosen && (
          <p className="mt-5 flex items-center gap-2 text-[12.5px] text-muted">
            <ConfidenceBadge confidence={chosen.confidence} />
            {chosen.confidence === "high" ? "Le serveur déclare un fichier audio, confirmé par son contenu." : "Fichier audio reconnu par son contenu (type non déclaré par le serveur)."}
          </p>
        )}

        {local.length > 0 && (
          <fieldset className="mt-5">
            <legend className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
              {local.length > 1 ? "Correspondances dans votre bibliothèque" : "Correspondance dans votre bibliothèque"}
            </legend>
            <div className="flex flex-col gap-1" role="radiogroup">
              {r.candidates.map((c, i) =>
                c.track ? (
                  <button
                    key={c.track.id}
                    type="button"
                    role="radio"
                    aria-checked={i === selected}
                    data-autofocus={i === selected ? true : undefined}
                    onClick={() => useSmartLink.setState({ selected: i })}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-left ring-1 transition-colors",
                      i === selected ? "bg-white/[0.06] ring-white/20" : "ring-transparent hover:bg-white/[0.03]",
                    )}
                  >
                    <Artwork src={coverUrl(c.track.cover)} seed={c.track.album} className="size-10 rounded-[4px] shadow-none" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{c.track.title}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {c.track.artist} · {c.track.album}
                      </span>
                    </span>
                    <ConfidenceBadge confidence={c.confidence} />
                  </button>
                ) : null,
              )}
            </div>
          </fieldset>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {r.candidates.length > 0 && (
            <>
              <button
                type="button"
                data-autofocus={local.length === 0 ? true : undefined}
                onClick={() => void act(r, selected, "play")}
                disabled={!canPlay}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-[13px] font-semibold text-bg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
              >
                {busy === "play" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />} Lire maintenant
              </button>
              <Button onClick={() => void act(r, selected, "enqueue")} disabled={!canPlay} className="h-9">
                {busy === "enqueue" ? <Loader2 className="size-4 animate-spin" /> : <ListEnd className="size-4" />} Ajouter à la file d'attente
              </Button>
            </>
          )}
          {r.importable && (
            <Button onClick={() => void act(r, selected, "import")} disabled={!!busy} className="h-9">
              {busy === "import" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Importer dans la bibliothèque
            </Button>
          )}
          {r.openUrl && (
            <Button
              className="h-9"
              data-autofocus={r.candidates.length === 0 ? true : undefined}
              onClick={() => void openUrl(r.openUrl!).catch((e) => toast.error("Ouverture impossible", { description: errorMessage(e) }))}
            >
              <ExternalLink className="size-4" /> Ouvrir dans {r.provider}
            </Button>
          )}
          {r.candidates.length === 0 && !r.openUrl && (
            <Button data-autofocus onClick={closeLink} className="h-9">
              Fermer
            </Button>
          )}
        </div>
        {(r.source === "youtube" || r.source === "spotify") && (
          <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
            Informations fournies par {r.provider}. KORZ lit le titre correspondant de votre bibliothèque ; il ne lit ni ne télécharge le contenu de {r.provider}.
          </p>
        )}
      </div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const c = CONFIDENCE[confidence];
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", c.className)}>{c.label}</span>;
}
