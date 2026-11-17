import type { Artist } from "@/types";
import { useNavigation } from "@/store/navigation";
import { prefetchArtist } from "@/store/catalog";
import { Artwork } from "@/components/ui/Artwork";

export function ArtistCard({ artist }: { artist: Artist }) {
  const navigate = useNavigation((s) => s.navigate);
  return (
    <button
      type="button"
      onPointerEnter={() => prefetchArtist(artist.id)}
      onClick={() => navigate({ name: "artist", id: artist.id })}
      className="rounded-lg p-3 text-left transition-colors duration-150 hover:bg-white/[0.04]"
    >
      <Artwork src={artist.picture} seed={artist.id} round className="aspect-square w-full" />
      <div className="mt-3 truncate text-[14px] font-semibold">{artist.name}</div>
      <div className="text-[13px] text-muted">Artiste</div>
    </button>
  );
}

export function ArtistGrid({ artists }: { artists: Artist[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
      {artists.map((a) => (
        <ArtistCard key={a.id} artist={a} />
      ))}
    </div>
  );
}
