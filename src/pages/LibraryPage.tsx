import { Library } from "lucide-react";
import { api } from "@/services/api";
import { useQuery } from "@/hooks/useQuery";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { useNavigation } from "@/store/navigation";
import { playTracks } from "@/store/player";
import { PageHeader } from "@/components/layout/PageHeader";
import { TrackTable } from "@/components/track/TrackTable";
import { AlbumGrid, ArtistGrid } from "@/components/track/CollectionGrid";
import { AddFolderButton } from "@/components/library/AddFolderButton";
import { PlayButton } from "@/components/ui/Button";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";

type Tab = "tracks" | "albums" | "artists";
const TABS: { id: Tab; label: string }[] = [
  { id: "albums", label: "Albums" },
  { id: "artists", label: "Artistes" },
  { id: "tracks", label: "Titres" },
];

export function LibraryPage({ tab = "albums" }: { tab?: Tab }) {
  const navigate = useNavigation((s) => s.navigate);
  const stats = useQuery(() => api.stats(), []);
  if (stats.data?.tracks === 0)
    return (
      <EmptyState icon={Library} title="Aucun titre pour l'instant">
        <p>Ajoutez un dossier de musique pour remplir votre bibliothèque.</p>
        <div className="mt-6 flex justify-center">
          <AddFolderButton />
        </div>
      </EmptyState>
    );
  return (
    <>
      <PageHeader title="Ma bibliothèque" subtitle={stats.data && `${plural(stats.data.tracks, "titre", "titres")} · ${plural(stats.data.albums, "album", "albums")}`}>
        <AddFolderButton variant="ghost" />
      </PageHeader>
      <div role="tablist" aria-label="Vue de la bibliothèque" className="mb-6 flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => navigate({ name: "library", tab: t.id })}
            className={cn(
              "h-8 rounded-full px-4 text-[13px] font-medium transition-colors",
              tab === t.id ? "bg-fg text-bg" : "bg-white/[0.06] text-fg hover:bg-white/[0.1]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "albums" && <Albums />}
      {tab === "artists" && <Artists />}
      {tab === "tracks" && <Tracks />}
    </>
  );
}

function Albums() {
  const q = useQuery(() => api.albums(), []);
  if (q.status === "error") return <ErrorState message={q.error} />;
  return q.data ? <AlbumGrid albums={q.data} /> : <Spinner />;
}

function Artists() {
  const q = useQuery(() => api.artists(), []);
  if (q.status === "error") return <ErrorState message={q.error} />;
  return q.data ? <ArtistGrid artists={q.data} /> : <Spinner />;
}

function Tracks() {
  const q = useQuery(() => api.tracks(), []);
  if (q.status === "error") return <ErrorState message={q.error} />;
  if (!q.data) return <Spinner />;
  return (
    <>
      <PlayButton label="Lire toute la bibliothèque" onClick={() => playTracks(q.data!, 0)} disabled={!q.data.length} className="mb-6" />
      <TrackTable tracks={q.data} />
    </>
  );
}
