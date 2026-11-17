import { Play } from "lucide-react";
import { artists, getArtist, tracks } from "@/services/catalog";
import { usePlayer, useCurrentTrack } from "@/store/player";
import { useNavigation } from "@/store/navigation";
import { useSettings } from "@/store/settings";
import { Artwork } from "@/components/ui/Artwork";
import { cn } from "@/lib/cn";

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "Bonne nuit" : h < 18 ? "Bonjour" : "Bonsoir";
};

const picks = tracks.filter((_, i) => i % 3 === 0).slice(0, 6);

export function HomePage() {
  const name = useSettings((s) => s.profile.displayName);
  const playQueue = usePlayer((s) => s.playQueue);
  const current = useCurrentTrack();
  const navigate = useNavigation((s) => s.navigate);

  return (
    <div className="px-8 pb-12 pt-20">
      <h1 className="font-display text-[32px] font-bold tracking-[-0.025em]">
        {greeting()}, {name}
      </h1>

      <section className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-3">
        {picks.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => playQueue(picks, i)}
            className={cn(
              "group flex h-16 items-center gap-4 overflow-hidden rounded-md bg-white/[0.05] pr-4 text-left transition-colors duration-150 hover:bg-white/[0.09]",
              current?.id === t.id && "bg-white/[0.08]",
            )}
          >
            <Artwork hue={t.hue} className="h-16 w-16 rounded-none shadow-none" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">{t.title}</div>
              <div className="truncate text-[12px] text-muted">{getArtist(t.artistId)?.name}</div>
            </div>
            <span className="flex size-9 translate-y-1 items-center justify-center rounded-full bg-accent text-bg opacity-0 shadow-[0_6px_16px_rgb(0_0_0/0.4)] transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
              <Play className="ml-0.5 size-4 fill-current" />
            </span>
          </button>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="mb-4 font-display text-[20px] font-bold tracking-[-0.02em]">Vos artistes</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
          {artists.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => navigate({ name: "artist", id: a.id })}
              className="rounded-lg p-3 text-left transition-colors duration-150 hover:bg-white/[0.04]"
            >
              <Artwork hue={a.hue} round className="aspect-square w-full" />
              <div className="mt-3 truncate text-[14px] font-semibold">{a.name}</div>
              <div className="text-[13px] text-muted">Artiste · {a.genre}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
