import { api, coverUrl } from "@/services/api";
import { useQuery } from "@/hooks/useQuery";
import { formatDuration, plural } from "@/lib/format";
import { playTracks } from "@/store/player";
import { useNavigation } from "@/store/navigation";
import { CollectionHeader } from "@/components/layout/CollectionHeader";
import { TrackTable } from "@/components/track/TrackTable";
import { PlayButton } from "@/components/ui/Button";
import { ErrorState, Spinner } from "@/components/ui/States";

export function AlbumPage({ title, artist }: { title: string; artist: string }) {
  const navigate = useNavigation((s) => s.navigate);
  const q = useQuery(() => api.tracks({ album: title, albumArtist: artist }), [title, artist]);
  if (q.status === "error") return <ErrorState message={q.error} />;
  if (!q.data) return <Spinner />;
  const tracks = q.data;
  if (!tracks.length) return <ErrorState message="Cet album n'est plus dans la bibliothèque." />;
  const first = tracks[0]!;
  const total = tracks.reduce((n, t) => n + t.durationMs, 0);
  return (
    <>
      <CollectionHeader
        kind="Album"
        title={title}
        cover={coverUrl(first.cover)}
        seed={title}
        details={
          <>
            <button type="button" onClick={() => navigate({ name: "artist", artist })} className="font-semibold text-fg hover:underline">
              {artist}
            </button>
            {first.year && <span>· {first.year}</span>}
            <span>· {plural(tracks.length, "titre", "titres")}</span>
            <span>· {formatDuration(total)}</span>
          </>
        }
      >
        <PlayButton label={`Lire ${title}`} onClick={() => playTracks(tracks, 0)} />
      </CollectionHeader>
      <TrackTable tracks={tracks} showAlbum={false} albumNumbers />
    </>
  );
}
