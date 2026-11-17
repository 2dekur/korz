import { Play } from "lucide-react";
import { tracks } from "@/services/catalog";
import { usePlayer } from "@/store/player";
import { TrackList } from "@/components/track/TrackList";

export function LibraryPage() {
  const playQueue = usePlayer((s) => s.playQueue);
  return (
    <div className="px-8 pb-12 pt-20">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-bold tracking-[-0.025em]">Bibliothèque</h1>
          <p className="mt-1 text-[13px] text-muted">{tracks.length} titres</p>
        </div>
        <button
          type="button"
          onClick={() => playQueue(tracks, 0)}
          className="flex h-10 items-center gap-2 rounded-full bg-fg px-5 text-[13px] font-semibold text-bg transition-transform duration-150 hover:scale-[1.03] active:scale-95"
        >
          <Play className="size-4 fill-current" /> Tout lire
        </button>
      </div>
      <TrackList tracks={tracks} />
    </div>
  );
}
