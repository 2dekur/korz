import { api, coverUrl } from "@/services/api";
import { useQuery } from "@/hooks/useQuery";
import { plural } from "@/lib/format";
import { playTracks } from "@/store/player";
import { CollectionHeader } from "@/components/layout/CollectionHeader";
import { AlbumGrid } from "@/components/track/CollectionGrid";
import { TrackTable } from "@/components/track/TrackTable";
import { PlayButton } from "@/components/ui/Button";
import { ErrorState, Spinner } from "@/components/ui/States";
import { SectionTitle } from "./HomePage";

export function ArtistPage({ artist }: { artist: string }) {
  const tracks = useQuery(() => api.tracks({ artist }), [artist]);
  const albums = useQuery(() => api.albums(artist), [artist]);
  if (tracks.status === "error") return <ErrorState message={tracks.error} />;
  if (!tracks.data) return <Spinner />;
  const list = tracks.data;
  if (!list.length) return <ErrorState message="Cet artiste n'est plus dans la bibliothèque." />;
  const cover = albums.data?.find((a) => a.cover)?.cover ?? list.find((t) => t.cover)?.cover ?? null;
  return (
    <>
      <CollectionHeader
        kind="Artiste"
        title={artist}
        cover={coverUrl(cover)}
        seed={artist}
        round
        details={
          <span>
            {plural(albums.data?.length ?? 0, "album", "albums")} · {plural(list.length, "titre", "titres")}
          </span>
        }
      >
        <PlayButton label={`Lire ${artist}`} onClick={() => playTracks(list, 0)} />
      </CollectionHeader>
      {albums.data && albums.data.length > 0 && (
        <section className="mb-12">
          <SectionTitle>Albums</SectionTitle>
          <AlbumGrid albums={albums.data} showArtist={false} />
        </section>
      )}
      <section>
        <SectionTitle>Titres</SectionTitle>
        <TrackTable tracks={list} />
      </section>
    </>
  );
}
