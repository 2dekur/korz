import { useState } from "react";
import { FolderPlus, Loader2, Play, RefreshCw, X } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { Track } from "@/types";
import { cn } from "@/lib/cn";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { pickFolder } from "@/services/localFiles";
import { TrackList } from "@/components/track/TrackList";
import { ArtistGrid } from "@/components/track/ArtistCard";

type Tab = "liked" | "artists" | "local";
const TABS: { id: Tab; label: string }[] = [
  { id: "liked", label: "Titres likés" },
  { id: "artists", label: "Artistes" },
  { id: "local", label: "Fichiers locaux" },
];

let lastTab: Tab = "liked"; // remembered across page switches

export function LibraryPage() {
  const [tab, setTabState] = useState<Tab>(lastTab);
  const setTab = (t: Tab) => setTabState((lastTab = t));
  const liked = useLibrary((s) => s.liked);
  const followed = useLibrary((s) => s.followed);
  const local = useLibrary((s) => s.local);

  return (
    <div className="px-8 pb-12 pt-20">
      <h1 className="font-display text-[32px] font-bold tracking-[-0.025em]">Bibliothèque</h1>
      <div className="mt-5 flex gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "h-8 rounded-full px-4 text-[13px] font-medium transition-colors duration-150",
              tab === t.id ? "bg-fg text-bg" : "bg-white/[0.06] text-fg hover:bg-white/[0.1]",
            )}
          >
            {t.label}
            <span className={cn("ml-1.5 tabular-nums", tab === t.id ? "text-bg/60" : "text-faint")}>
              {t.id === "liked" ? liked.length : t.id === "artists" ? followed.length : local.length}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "liked" && <TracksTab tracks={liked} empty="Les titres ajoutés avec + apparaissent ici." />}
        {tab === "artists" &&
          (followed.length ? <ArtistGrid artists={followed} /> : <Empty>Abonnez-vous à des artistes depuis la recherche ou leur page.</Empty>)}
        {tab === "local" && <LocalTab />}
      </div>
    </div>
  );
}

function TracksTab({ tracks, empty }: { tracks: Track[]; empty: string }) {
  const playQueue = usePlayer((s) => s.playQueue);
  if (!tracks.length) return <Empty>{empty}</Empty>;
  return (
    <>
      <button
        type="button"
        onClick={() => playQueue(tracks, 0)}
        className="mb-6 flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[13px] font-semibold text-bg transition-transform duration-150 hover:scale-[1.03] active:scale-95"
      >
        <Play className="size-4 fill-current" /> Tout lire
      </button>
      <TrackList tracks={tracks} />
    </>
  );
}

function LocalTab() {
  const folders = useLibrary((s) => s.folders);
  const local = useLibrary((s) => s.local);
  const scanning = useLibrary((s) => s.scanning);
  const { addFolder, removeFolder, rescan } = useLibrary.getState();
  const desktop = isTauri();

  const add = async () => {
    try {
      const path = await pickFolder();
      if (path) await addFolder(path);
    } catch (err) {
      toast.error("Impossible d'ouvrir ce dossier", { description: String(err) });
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={add}
          disabled={!desktop || scanning}
          className="flex h-9 items-center gap-2 rounded-full bg-fg px-4 text-[13px] font-semibold text-bg transition hover:scale-[1.03] active:scale-95 disabled:opacity-40"
        >
          <FolderPlus className="size-4" /> Ajouter un dossier
        </button>
        {folders.length > 0 && (
          <button
            type="button"
            onClick={() => void rescan()}
            disabled={!desktop || scanning}
            className="flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold ring-1 ring-white/20 transition hover:ring-white/50 disabled:opacity-40"
          >
            {scanning ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Rescanner
          </button>
        )}
      </div>
      {!desktop && <p className="mt-3 text-[13px] text-faint">L'accès aux fichiers locaux n'existe que dans l'application desktop.</p>}

      {folders.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {folders.map((f) => (
            <li key={f} className="flex h-8 items-center gap-2 rounded-full bg-white/[0.05] pl-3 pr-1.5 text-[12px] text-muted">
              <span className="max-w-[360px] truncate" title={f}>
                {f}
              </span>
              <button type="button" aria-label={`Retirer ${f}`} onClick={() => removeFolder(f)} className="rounded-full p-1 hover:bg-white/10 hover:text-fg">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        {local.length ? <TracksTab tracks={local} empty="" /> : <Empty>Ajoutez un dossier contenant des fichiers MP3, FLAC, WAV, M4A ou OGG.</Empty>}
      </div>
    </>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="py-10 text-[14px] text-muted">{children}</p>;
}
