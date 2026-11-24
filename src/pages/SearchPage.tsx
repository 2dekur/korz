import { useMemo } from "react";
import { Search } from "lucide-react";
import { api } from "@/services/api";
import { useQuery } from "@/hooks/useQuery";
import { useDebounce } from "@/hooks/useDebounce";
import { useUi } from "@/store/ui";
import type { Album } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { TrackTable } from "@/components/track/TrackTable";
import { AlbumGrid } from "@/components/track/CollectionGrid";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SectionTitle } from "./HomePage";

export function SearchPage() {
  const search = useDebounce(useUi((s) => s.search).trim(), 200);
  const result = useQuery(() => (search ? api.tracks({ search }) : Promise.resolve([])), [search]);

  // Albums appearing in the matches, in match order (display grouping only).
  const albums = useMemo(() => {
    const seen = new Map<string, Album>();
    for (const t of result.data ?? []) {
      const key = `${t.albumArtist}\u001f${t.album}`;
      const a = seen.get(key);
      if (a) {
        a.trackCount += 1;
        a.durationMs += t.durationMs;
      } else seen.set(key, { title: t.album, artist: t.albumArtist, year: t.year, cover: t.cover, trackCount: 1, durationMs: t.durationMs });
    }
    return [...seen.values()].slice(0, 6);
  }, [result.data]);

  if (!search)
    return (
      <EmptyState icon={Search} title="Rechercher dans la bibliothèque">
        Titres, artistes et albums de vos dossiers. Raccourci : Ctrl+K.
      </EmptyState>
    );
  if (result.status === "error") return <ErrorState message={result.error} />;
  const tracks = result.data ?? [];

  return (
    <>
      <PageHeader title={`« ${search} »`} subtitle={result.status === "loading" ? "Recherche…" : `${tracks.length}${tracks.length === 500 ? "+" : ""} résultat${tracks.length > 1 ? "s" : ""}`} />
      {result.status === "ready" && tracks.length === 0 && <p className="text-[14px] text-muted">Aucun titre, artiste ou album ne correspond.</p>}
      {albums.length > 0 && (
        <section className="mb-12">
          <SectionTitle>Albums</SectionTitle>
          <AlbumGrid albums={albums} />
        </section>
      )}
      {tracks.length > 0 && (
        <section>
          <SectionTitle>Titres</SectionTitle>
          <TrackTable tracks={tracks} />
        </section>
      )}
    </>
  );
}
