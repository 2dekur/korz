import { Pause, Play } from "lucide-react";
import { useAlbumPage, retry } from "@/store/catalog";
import { usePlayer, useCurrentTrack } from "@/store/player";
import { usePrefetchTracks } from "@/hooks/useHoverPrefetch";
import { Artwork } from "@/components/ui/Artwork";
import { ErrorState, RowSkeleton } from "@/components/ui/States";
import { TrackList } from "@/components/track/TrackList";
import { ArtistLinks } from "@/components/track/ArtistLinks";

function totalDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

export function AlbumPage({ id }: { id: string }) {
  const entry = useAlbumPage(id);
  usePrefetchTracks(entry?.status === "ready" ? entry.data.tracks : undefined);
  const playQueue = usePlayer((s) => s.playQueue);
  const toggle = usePlayer((s) => s.toggle);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const queue = usePlayer((s) => s.queue);
  const current = useCurrentTrack();

  if (entry?.status === "error")
    return (
      <div className="px-8 pt-20">
        <ErrorState message={entry.error} onRetry={() => retry("albums", id)} />
      </div>
    );

  const data = entry?.status === "ready" ? entry.data : undefined;
  const tracks = data?.tracks ?? [];
  const playingThis = !!current && queue === tracks && tracks.length > 0;
  const total = tracks.reduce((sum, t) => sum + t.duration, 0);

  return (
    <div className="pb-12">
      <header className="relative flex h-[340px] items-end overflow-hidden px-8 pb-8">
        {data?.coverLarge && (
          <img src={data.coverLarge} alt="" draggable={false} className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-3xl saturate-150" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-surface" />
        <div className="relative flex min-w-0 items-end gap-7">
          {data ? (
            <Artwork src={data.coverLarge ?? data.album.cover} seed={id} className="size-56 rounded-md shadow-[0_24px_64px_rgb(0_0_0/0.55)]" />
          ) : (
            <div className="size-56 animate-pulse rounded-md bg-white/[0.06]" />
          )}
          <div className="min-w-0 pb-1">
            {data ? (
              <>
                <div className="text-[13px] font-medium text-white/80">{data.album.type}</div>
                <h1 className="mt-2 line-clamp-2 font-display text-[56px] font-extrabold leading-[1.02] tracking-[-0.04em]">{data.album.title}</h1>
                <div className="mt-4 flex items-center gap-1.5 text-[14px] text-white/80">
                  <ArtistLinks artists={data.artists} className="text-[14px] font-semibold text-fg" />
                  <span className="shrink-0">
                    {[data.album.year, `${tracks.length} titres`, total ? totalDuration(total) : null].filter(Boolean).map((x) => ` · ${x}`)}
                  </span>
                </div>
              </>
            ) : (
              <div className="h-14 w-96 animate-pulse rounded-lg bg-white/[0.06]" />
            )}
          </div>
        </div>
      </header>

      <div className="px-8">
        <div className="py-6">
          <button
            type="button"
            disabled={!tracks.length}
            aria-label={playingThis && isPlaying ? "Pause" : `Lire ${data?.album.title ?? "l'album"}`}
            onClick={() => (playingThis ? toggle() : playQueue(tracks, 0))}
            className="flex size-14 items-center justify-center rounded-full bg-accent text-bg shadow-[0_8px_24px_rgb(0_0_0/0.4)] transition-transform duration-150 hover:scale-[1.04] active:scale-95 disabled:opacity-40"
          >
            {playingThis && isPlaying ? <Pause className="size-6 fill-current" /> : <Play className="ml-1 size-6 fill-current" />}
          </button>
        </div>
        {data ? <TrackList tracks={tracks} showAlbum={false} /> : <RowSkeleton rows={8} />}
        {data?.label && <p className="mt-8 text-[12px] text-faint">© {data.label}</p>}
      </div>
    </div>
  );
}
