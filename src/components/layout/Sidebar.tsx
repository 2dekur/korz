import { Heart, House, Library, Link2, ListMusic, Loader2, Plug, Search, Settings, type LucideIcon } from "lucide-react";
import type { Route } from "@/types";
import { cn } from "@/lib/cn";
import { api } from "@/services/api";
import { useQuery } from "@/hooks/useQuery";
import { useNavigation, useRoute } from "@/store/navigation";
import { useLibrary } from "@/store/library";
import { Logo } from "@/components/ui/Logo";

const MAIN: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: { name: "home" }, label: "Accueil", icon: House },
  { route: { name: "search" }, label: "Recherche", icon: Search },
  { route: { name: "library" }, label: "Ma bibliothèque", icon: Library },
  { route: { name: "playlists" }, label: "Playlists", icon: ListMusic },
  { route: { name: "favorites" }, label: "Favoris", icon: Heart },
];

const SOURCES: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: { name: "import" }, label: "Importer un lien", icon: Link2 },
  { route: { name: "services" }, label: "Services connectés", icon: Plug },
];

export function Sidebar() {
  const route = useRoute();
  const navigate = useNavigation((s) => s.navigate);
  const playlists = useQuery(() => api.playlists(), []);
  const scanning = useLibrary((s) => s.scanning);
  const isActive = (r: Route) => route.name === r.name || (r.name === "playlists" && route.name === "playlist") || (r.name === "library" && (route.name === "album" || route.name === "artist"));

  return (
    <aside className="flex min-h-0 flex-col border-r border-line bg-bg">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <Logo className="size-7" />
        <span className="font-display text-[15px] font-bold tracking-[0.04em]">KORZ</span>
      </div>

      <nav className="flex flex-col gap-px px-3 pt-2" aria-label="Navigation principale">
        {MAIN.map((item) => (
          <NavItem key={item.route.name} item={item} active={isActive(item.route)} onClick={() => navigate(item.route)} />
        ))}
      </nav>

      <SectionLabel>Sources</SectionLabel>
      <nav className="flex flex-col gap-px px-3" aria-label="Sources">
        {SOURCES.map((item) => (
          <NavItem key={item.route.name} item={item} active={isActive(item.route)} onClick={() => navigate(item.route)} />
        ))}
      </nav>

      <SectionLabel>Playlists</SectionLabel>
      <div className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-3 pb-2">
        {playlists.data?.length === 0 && <p className="px-3 text-[12px] leading-relaxed text-faint">Aucune playlist pour l'instant.</p>}
        {playlists.data?.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => navigate({ name: "playlist", id: p.id })}
            aria-current={route.name === "playlist" && route.id === p.id ? "page" : undefined}
            className={cn(
              "h-8 truncate rounded-md px-3 text-left text-[13px] transition-colors",
              route.name === "playlist" && route.id === p.id ? "bg-white/[0.06] text-fg" : "text-muted hover:text-fg",
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      {scanning && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-[12px] text-muted" role="status">
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
          <span className="truncate">
            Analyse {scanning.done}/{scanning.total}
          </span>
        </div>
      )}

      <div className="border-t border-line p-3">
        <NavItem item={{ label: "Paramètres", icon: Settings }} active={route.name === "settings"} onClick={() => navigate({ name: "settings" })} />
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <div className="px-6 pb-1.5 pt-6 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{children}</div>;
}

function NavItem({ item: { label, icon: Icon }, active, onClick }: { item: { label: string; icon: LucideIcon }; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-[13.5px] font-medium transition-colors duration-100",
        active ? "bg-white/[0.06] text-fg" : "text-muted hover:bg-white/[0.03] hover:text-fg",
      )}
    >
      <Icon className={cn("size-[17px] shrink-0", active && "text-accent")} strokeWidth={active ? 2.2 : 1.8} />
      {label}
    </button>
  );
}
