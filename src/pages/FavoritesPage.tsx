import { Heart } from "lucide-react";
import { api } from "@/services/api";
import { useQuery } from "@/hooks/useQuery";
import { formatDuration, plural } from "@/lib/format";
import { playTracks } from "@/store/player";
import { PageHeader } from "@/components/layout/PageHeader";
import { TrackTable } from "@/components/track/TrackTable";
import { PlayButton } from "@/components/ui/Button";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";

export function FavoritesPage() {
  const q = useQuery(() => api.tracks({ favorites: true }), []);
  if (q.status === "error") return <ErrorState message={q.error} />;
  if (!q.data) return <Spinner />;
  const tracks = q.data;
  if (!tracks.length)
    return (
      <EmptyState icon={Heart} title="Aucun favori">
        Utilisez le cœur à côté d'un titre pour le retrouver ici.
      </EmptyState>
    );
  return (
    <>
      <PageHeader title="Favoris" subtitle={`${plural(tracks.length, "titre", "titres")} · ${formatDuration(tracks.reduce((n, t) => n + t.durationMs, 0))}`}>
        <PlayButton label="Lire les favoris" onClick={() => playTracks(tracks, 0)} />
      </PageHeader>
      <TrackTable tracks={tracks} />
    </>
  );
}
