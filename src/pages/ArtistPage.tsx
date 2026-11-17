import { Pause, Play } from "lucide-react";
import { usePrefetchTracks } from "@/hooks/useHoverPrefetch";
import { useArtistPage, retry } from "@/store/catalog";
import { usePlayer, useCurrentTrack } from "@/store/player";
import { useLibrary } from "@/store/library";
import { Artwork } from "@/components/ui/Artwork";
import { VerifiedBadge } from "@/components/ui/Badges";
import { ErrorState, RowSkeleton } from "@/components/ui/States";
import { TrackList } from "@/components/track/TrackList";
import { FollowButton } from "@/components/track/FollowButton";

const fansFmt = new Intl.NumberFormat("fr-FR");

export function ArtistPage({ id }: { id: string }) {
  const entry = useArtistPage(id);
  usePrefetchTracks(entry?.status === "ready" ? entry.data.top : undefined);
  // A followed artist renders its header instantly from the library while the rest loads.
  const known = useLibrary((s) => s.followed.find((a) => a.id === id));
  const playQueue = usePlayer((s) => s.playQueue);
  const toggle = usePlayer((s) => s.toggle);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const queue = usePlayer((s) => s.queue);
  const current = useCurrentTrack();

  if (entry?.status === "error")
    return (
      <div className="px-8 pt-20">
        <ErrorState message={entry.error} onRetry={() => retry("artists", id)} />
      </div>
    );

  const data = entry?.status === "ready" ? entry.data : undefined;
  const artist = data?.artist ?? known;
  const top = data?.top ?? [];
  const playingThis = !!current && queue === top && top.length > 0;

  return (
    <div className="pb-12">
      <header className="relative flex h-[380px] items-end overflow-hidden px-8 pb-8">
        {artist?.pictureLarge && (
          <img
            src={artist.pictureLarge}
            alt=""
            draggable={false}
            className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-3xl saturate-150"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-surface" />
        <div className="relative flex min-w-0 items-end gap-7">
          {artist ? (
            <Artwork src={artist.pictureLarge} seed={artist.id} round className="size-52 shadow-[0_24px_64px_rgb(0_0_0/0.55)]" />
          ) : (
            <div className="size-52 animate-pulse rounded-full bg-white/[0.06]" />
          )}
          <div className="min-w-0 pb-2">
            {artist ? (
              <>
                <div className="flex items-center gap-2 text-[13px] font-medium text-white/80">
                  <VerifiedBadge fans={artist.fans} className="size-5 fill-sky-500 text-bg" />
                  Artiste
                </div>
                <h1 className="mt-2 truncate font-display text-[76px] font-extrabold leading-[0.95] tracking-[-0.045em]">{artist.name}</h1>
                {artist.fans !== undefined && (
                  <div className="mt-4 text-[14px] text-white/75">{fansFmt.format(artist.fans)} fans</div>
                )}
              </>
            ) : (
              <div className="h-16 w-96 animate-pulse rounded-lg bg-white/[0.06]" />
            )}
          </div>
        </div>
      </header>

      <div className="px-8">
        <div className="flex items-center gap-5 py-6">
          <button
            type="button"
            disabled={!top.length}
            aria-label={playingThis && isPlaying ? "Pause" : `Lire ${artist?.name ?? ""}`}
            onClick={() => (playingThis ? toggle() : playQueue(top, 0))}
            className="flex size-14 items-center justify-center rounded-full bg-accent text-bg shadow-[0_8px_24px_rgb(0_0_0/0.4)] transition-transform duration-150 hover:scale-[1.04] active:scale-95 disabled:opacity-40"
          >
            {playingThis && isPlaying ? <Pause className="size-6 fill-current" /> : <Play className="ml-1 size-6 fill-current" />}
          </button>
          {artist && <FollowButton artist={artist} />}
        </div>

        <h2 className="mb-3 font-display text-[22px] font-bold tracking-[-0.02em]">Populaires</h2>
        {data ? <TrackList tracks={top} /> : <RowSkeleton rows={5} />}

        {data && data.albums.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 font-display text-[22px] font-bold tracking-[-0.02em]">Discographie</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-2 gap-y-4">
              {data.albums.map((al) => (
                <div key={al.id} className="rounded-lg p-3">
                  <Artwork src={al.cover} seed={al.id} className="aspect-square w-full" />
                  <div className="mt-3 truncate text-[14px] font-semibold" title={al.title}>
                    {al.title}
                  </div>
                  <div className="text-[13px] text-muted">{[al.year, al.type].filter(Boolean).join(" · ")}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
