import { Play } from "lucide-react";
import { toast } from "sonner";
import type { Album, Artist } from "@/types";
import { api, coverUrl, errorMessage } from "@/services/api";
import { plural } from "@/lib/format";
import { playTracks } from "@/store/player";
import { useNavigation } from "@/store/navigation";
import { Artwork } from "@/components/ui/Artwork";

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-5 gap-y-7";

export async function playAlbum(album: Pick<Album, "title" | "artist">) {
  try {
    const tracks = await api.tracks({ album: album.title, albumArtist: album.artist });
    if (tracks.length) playTracks(tracks, 0);
  } catch (err) {
    toast.error("Lecture impossible", { description: errorMessage(err) });
  }
}

export function AlbumGrid({ albums, showArtist = true }: { albums: Album[]; showArtist?: boolean }) {
  const navigate = useNavigation((s) => s.navigate);
  return (
    <div className={GRID}>
      {albums.map((a) => (
        <div key={`${a.artist}\u001f${a.title}`} className="group min-w-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => navigate({ name: "album", title: a.title, artist: a.artist })}
              className="block w-full"
              aria-label={`Ouvrir l'album ${a.title}`}
            >
              <Artwork src={coverUrl(a.cover)} seed={a.title} className="aspect-square w-full" />
            </button>
            <button
              type="button"
              aria-label={`Lire l'album ${a.title}`}
              onClick={() => void playAlbum(a)}
              className="absolute bottom-2.5 right-2.5 flex size-10 translate-y-1.5 items-center justify-center rounded-full bg-accent text-bg opacity-0 shadow-[0_8px_20px_rgb(0_0_0/0.45)] transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100"
            >
              <Play className="ml-0.5 size-4 fill-current" />
            </button>
          </div>
          <div className="mt-2.5 truncate text-[14px] font-medium">{a.title}</div>
          <div className="truncate text-[12.5px] text-muted">
            {showArtist ? a.artist : plural(a.trackCount, "titre", "titres")}
            {a.year ? ` · ${a.year}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ArtistGrid({ artists }: { artists: Artist[] }) {
  const navigate = useNavigation((s) => s.navigate);
  return (
    <div className={GRID}>
      {artists.map((a) => (
        <button key={a.name} type="button" onClick={() => navigate({ name: "artist", artist: a.name })} className="group min-w-0 text-left">
          <Artwork src={coverUrl(a.cover)} seed={a.name} round className="aspect-square w-full transition-transform duration-200 group-hover:scale-[1.02]" />
          <div className="mt-2.5 truncate text-[14px] font-medium">{a.name}</div>
          <div className="truncate text-[12.5px] text-muted">
            {plural(a.albumCount, "album", "albums")} · {plural(a.trackCount, "titre", "titres")}
          </div>
        </button>
      ))}
    </div>
  );
}
