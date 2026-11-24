import { Music2 } from "lucide-react";
import { api } from "@/services/api";
import { useQuery } from "@/hooks/useQuery";
import { formatDuration, plural } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { AlbumGrid } from "@/components/track/CollectionGrid";
import { TrackTable } from "@/components/track/TrackTable";
import { AddFolderButton } from "@/components/library/AddFolderButton";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";

export function HomePage() {
  const stats = useQuery(() => api.stats(), []);
  const recent = useQuery(() => api.history(8), []);
  const added = useQuery(() => api.recentlyAdded(12), []);

  if (stats.status === "error") return <ErrorState message={stats.error} />;
  if (!stats.data) return <Spinner />;
  const s = stats.data;

  if (s.tracks === 0)
    return (
      <EmptyState icon={Music2} title="Votre bibliothèque est vide">
        <p>Ajoutez un dossier contenant votre musique. Les fichiers restent où ils sont : KORZ les lit sans les déplacer ni les modifier.</p>
        <div className="mt-6 flex justify-center">
          <AddFolderButton />
        </div>
      </EmptyState>
    );

  return (
    <>
      <PageHeader
        title="Accueil"
        subtitle={`${plural(s.tracks, "titre", "titres")} · ${plural(s.albums, "album", "albums")} · ${plural(s.artists, "artiste", "artistes")} · ${formatDuration(s.durationMs)}`}
      />
      {recent.data && recent.data.length > 0 && (
        <section className="mb-12">
          <SectionTitle>Écoutés récemment</SectionTitle>
          <TrackTable tracks={recent.data} />
        </section>
      )}
      {added.data && added.data.length > 0 && (
        <section>
          <SectionTitle>Ajouts récents</SectionTitle>
          <AlbumGrid albums={added.data} />
        </section>
      )}
    </>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-4 font-display text-[19px] font-bold tracking-[-0.02em]">{children}</h2>;
}
