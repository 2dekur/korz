import { Pause, Play } from "lucide-react";
import { getArtist, tracksByArtist } from "@/services/catalog";
import { usePlayer, useCurrentTrack } from "@/store/player";
import { Artwork } from "@/components/ui/Artwork";
import { TrackList } from "@/components/track/TrackList";

export function ArtistPage({ id }: { id: string }) {
  const artist = getArtist(id);
  const playQueue = usePlayer((s) => s.playQueue);
  const toggle = usePlayer((s) => s.toggle);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const current = useCurrentTrack();

  if (!artist) return <div className="px-8 pt-24 text-muted">Artiste introuvable.</div>;
  const list = tracksByArtist(id);
  const playingThis = isPlaying && current?.artistId === id;

  return (
    <div className="pb-12">
      <header
        className="relative flex h-[340px] items-end gap-6 px-8 pb-8"
        style={{ background: `linear-gradient(180deg, hsl(${artist.hue} 45% 32%) 0%, hsl(${artist.hue} 35% 14%) 75%, transparent 100%)` }}
      >
        <Artwork hue={artist.hue} round className="size-48 shadow-[0_16px_48px_rgb(0_0_0/0.5)]" />
        <div className="min-w-0">
          <div className="text-[12px] font-medium uppercase tracking-[0.1em] text-white/70">{artist.genre}</div>
          <h1 className="mt-2 truncate font-display text-[72px] font-extrabold leading-none tracking-[-0.04em]">{artist.name}</h1>
          <div className="mt-4 text-[13px] text-white/70">{list.length} titres</div>
        </div>
      </header>

      <div className="px-8">
        <div className="flex items-center gap-6 py-6">
          <button
            type="button"
            aria-label={playingThis ? "Pause" : `Lire ${artist.name}`}
            onClick={() => (current?.artistId === id ? toggle() : playQueue(list, 0))}
            className="flex size-14 items-center justify-center rounded-full bg-accent text-bg shadow-[0_8px_24px_rgb(0_0_0/0.4)] transition-transform duration-150 hover:scale-[1.04] active:scale-95"
          >
            {playingThis ? <Pause className="size-6 fill-current" /> : <Play className="ml-1 size-6 fill-current" />}
          </button>
        </div>
        <h2 className="mb-3 font-display text-[20px] font-bold tracking-[-0.02em]">Populaires</h2>
        <TrackList tracks={list} />
      </div>
    </div>
  );
}
