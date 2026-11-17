import { Play } from "lucide-react";
import { usePrefetchTracks } from "@/hooks/useHoverPrefetch";
import { useHome, retry } from "@/store/catalog";
import { usePlayer, useCurrentTrack } from "@/store/player";
import { useSettings } from "@/store/settings";
import { useLibrary } from "@/store/library";
import { Artwork } from "@/components/ui/Artwork";
import { ErrorState } from "@/components/ui/States";
import { ArtistGrid } from "@/components/track/ArtistCard";
import { cn } from "@/lib/cn";

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "Bonne nuit" : h < 18 ? "Bonjour" : "Bonsoir";
};

export function HomePage() {
  const name = useSettings((s) => s.profile.displayName);
  const followed = useLibrary((s) => s.followed);
  const home = useHome();
  const playQueue = usePlayer((s) => s.playQueue);
  const current = useCurrentTrack();
  const picks = home?.status === "ready" ? home.data.tracks.slice(0, 6) : [];
  usePrefetchTracks(picks, 2);

  return (
    <div className="px-8 pb-12 pt-20">
      <h1 className="font-display text-[32px] font-bold tracking-[-0.025em]">
        {greeting()}, {name}
      </h1>

      {home?.status === "error" ? (
        <ErrorState message={home.error} onRetry={() => retry("home", "chart")} />
      ) : (
        <section className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-3" aria-busy={home?.status !== "ready"}>
          {home?.status !== "ready"
            ? Array.from({ length: 6 }, (_, i) => <div key={i} className="h-16 animate-pulse rounded-md bg-white/[0.04]" />)
            : picks.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => playQueue(picks, i)}
                  className={cn(
                    "group flex h-16 items-center gap-4 overflow-hidden rounded-md bg-white/[0.05] pr-4 text-left transition-colors duration-150 hover:bg-white/[0.09]",
                    current?.id === t.id && "bg-white/[0.08]",
                  )}
                >
                  <Artwork src={t.cover} seed={t.id} className="h-16 w-16 rounded-none shadow-none" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">{t.title}</div>
                    <div className="truncate text-[12px] text-muted">{t.artists.map((a) => a.name).join(", ")}</div>
                  </div>
                  <span className="flex size-9 shrink-0 translate-y-1 items-center justify-center rounded-full bg-accent text-bg opacity-0 shadow-[0_6px_16px_rgb(0_0_0/0.4)] transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                    <Play className="ml-0.5 size-4 fill-current" />
                  </span>
                </button>
              ))}
        </section>
      )}

      {followed.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-[20px] font-bold tracking-[-0.02em]">Vos abonnements</h2>
          <ArtistGrid artists={followed.slice(0, 12)} />
        </section>
      )}

      {home?.status === "ready" && (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-[20px] font-bold tracking-[-0.02em]">Artistes du moment</h2>
          <ArtistGrid artists={home.data.artists} />
        </section>
      )}
    </div>
  );
}
