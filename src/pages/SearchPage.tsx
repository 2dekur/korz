import { Play, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePrefetchTracks } from "@/hooks/useHoverPrefetch";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearch } from "@/store/search";
import { retry, searchKey, useSearchResults, prefetchArtist } from "@/store/catalog";
import { useNavigation } from "@/store/navigation";
import { usePlayer } from "@/store/player";
import { lyricsSearch, type LyricHit } from "@/services/lyrics";
import { seedVideoId } from "@/services/audioProviders";
import type { Track } from "@/types";
import { Artwork } from "@/components/ui/Artwork";
import { VerifiedBadge } from "@/components/ui/Badges";
import { ErrorState, RowSkeleton } from "@/components/ui/States";
import { TrackList } from "@/components/track/TrackList";
import { CompactTrackRow } from "@/components/track/CompactTrackRow";
import { FollowButton } from "@/components/track/FollowButton";
import { ArtistGrid } from "@/components/track/ArtistCard";
import { ArtistLinks } from "@/components/track/ArtistLinks";

function lyricHitToTrack(hit: LyricHit): Track {
  const id = `yt-${hit.video_id}`;
  seedVideoId(id, hit.video_id);
  return { id, title: hit.title, artists: hit.artists.map((name) => ({ name })), duration: hit.duration, explicit: false, src: "", source: "deezer" };
}

export function SearchPage() {
  const query = useSearch((s) => s.query);
  const debounced = useDebounce(query, 200);
  const entry = useSearchResults(debounced);
  usePrefetchTracks(entry?.status === "ready" ? entry.data.tracks : undefined);
  const navigate = useNavigation((s) => s.navigate);
  const playQueue = usePlayer((s) => s.playQueue);

  const isLyricsQuery = debounced.length > 15 && debounced.includes(" ");
  const [lyricHits, setLyricHits] = useState<LyricHit[]>([]);
  useEffect(() => {
    if (!isLyricsQuery) { setLyricHits([]); return; }
    lyricsSearch(debounced).then(setLyricHits);
  }, [debounced, isLyricsQuery]);
  const lyricsTracks = useMemo(() => lyricHits.map(lyricHitToTrack), [lyricHits]);

  if (!searchKey(debounced))
    return (
      <div className="flex flex-col items-center px-8 pb-12 pt-40 text-center">
        <Search className="size-10 text-faint" strokeWidth={1.5} />
        <h1 className="mt-4 font-display text-[22px] font-bold">Rechercher dans le catalogue</h1>
        <p className="mt-1 text-[14px] text-muted">Artistes, titres et albums, en temps réel.</p>
      </div>
    );

  if (entry?.status === "error")
    return (
      <div className="px-8 pt-20">
        <ErrorState message={entry.error} onRetry={() => retry("searches", searchKey(debounced))} />
      </div>
    );

  if (entry?.status !== "ready")
    return (
      <div className="px-8 pt-20">
        <RowSkeleton rows={8} />
      </div>
    );

  const { tracks, artists, topArtist } = entry.data;
  if (!tracks.length && !artists.length)
    return (
      <p className="px-8 pt-24 text-[14px] text-muted">
        Aucun résultat pour « <span className="text-fg">{debounced}</span> ».
      </p>
    );

  return (
    <div className="px-8 pb-12 pt-20">
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6">
        {topArtist && (
          <section>
            <h2 className="mb-3 font-display text-[22px] font-bold tracking-[-0.02em]">Meilleur résultat</h2>
            <div
              role="button"
              tabIndex={0}
              onPointerEnter={() => prefetchArtist(topArtist.id)}
              onClick={() => navigate({ name: "artist", id: topArtist.id })}
              onKeyDown={(e) => e.key === "Enter" && navigate({ name: "artist", id: topArtist.id })}
              className="flex h-[248px] flex-col justify-between rounded-xl bg-white/[0.04] p-5 transition-colors duration-150 hover:bg-white/[0.07]"
            >
              <Artwork src={topArtist.picture} seed={topArtist.id} round className="size-24" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="truncate font-display text-[30px] font-bold tracking-[-0.02em]">{topArtist.name}</span>
                  <VerifiedBadge fans={topArtist.fans} className="size-5 shrink-0 fill-sky-500 text-surface" />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="rounded-full bg-black/30 px-3 py-1 text-[12px] font-semibold">Artiste</span>
                  <FollowButton artist={topArtist} />
                </div>
              </div>
            </div>
          </section>
        )}
        {!topArtist && tracks[0] && (
          <section>
            <h2 className="mb-3 font-display text-[22px] font-bold tracking-[-0.02em]">Meilleur résultat</h2>
            <div
              role="button"
              tabIndex={0}
              onClick={() => playQueue(tracks, 0)}
              onKeyDown={(e) => e.key === "Enter" && playQueue(tracks, 0)}
              className="group relative flex h-[248px] flex-col justify-between rounded-xl bg-white/[0.04] p-5 transition-colors duration-150 hover:bg-white/[0.07]"
            >
              <Artwork src={tracks[0].cover} seed={tracks[0].id} className="size-24" />
              <div className="min-w-0">
                <div className="truncate font-display text-[30px] font-bold tracking-[-0.02em]">{tracks[0].title}</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-black/30 px-3 py-1 text-[12px] font-semibold">Titre</span>
                  <ArtistLinks artists={tracks[0].artists} className="text-[14px]" />
                </div>
              </div>
              <span className="absolute bottom-5 right-5 flex size-12 translate-y-2 items-center justify-center rounded-full bg-accent text-bg opacity-0 shadow-[0_8px_24px_rgb(0_0_0/0.4)] transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                <Play className="ml-0.5 size-5 fill-current" />
              </span>
            </div>
          </section>
        )}
        {tracks.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-[22px] font-bold tracking-[-0.02em]">Titres</h2>
            {tracks.slice(0, 4).map((t, i) => (
              <CompactTrackRow key={t.id} track={t} onClick={() => playQueue(tracks, i)} />
            ))}
          </section>
        )}
      </div>

      {artists.length > 1 && (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-[22px] font-bold tracking-[-0.02em]">Artistes</h2>
          <ArtistGrid artists={artists.slice(0, 7)} />
        </section>
      )}

      {tracks.length > 4 && (
        <section className="mt-12">
          <h2 className="mb-3 font-display text-[22px] font-bold tracking-[-0.02em]">Tous les titres</h2>
          <TrackList tracks={tracks} />
        </section>
      )}

      {lyricsTracks.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-1 font-display text-[22px] font-bold tracking-[-0.02em]">Résultats paroles</h2>
          <p className="mb-3 text-[13px] text-muted">Paroles : « {debounced} »</p>
          <TrackList tracks={lyricsTracks} />
        </section>
      )}
    </div>
  );
}
