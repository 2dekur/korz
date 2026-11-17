import { House, Library, Search, Settings, type LucideIcon } from "lucide-react";
import type { Route } from "@/types";
import { cn } from "@/lib/cn";
import { artists } from "@/services/catalog";
import { useNavigation, useRoute } from "@/store/navigation";
import { useSettings } from "@/store/settings";
import { Artwork, initials } from "@/components/ui/Artwork";

const NAV: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: { name: "home" }, label: "Accueil", icon: House },
  { route: { name: "search" }, label: "Recherche", icon: Search },
  { route: { name: "library" }, label: "Bibliothèque", icon: Library },
];

export function Sidebar() {
  const route = useRoute();
  const navigate = useNavigation((s) => s.navigate);
  const profile = useSettings((s) => s.profile);

  return (
    <aside className="flex min-h-0 flex-col border-r border-line bg-bg">
      <div className="flex h-16 items-center gap-2.5 px-6">
        <span className="relative flex size-6 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-accent/20" />
          <span className="size-2.5 rounded-full bg-accent" />
        </span>
        <span className="font-display text-[17px] font-bold tracking-[-0.02em]">Resonance</span>
      </div>

      <nav className="flex flex-col gap-0.5 px-3" aria-label="Navigation principale">
        {NAV.map(({ route: r, label, icon: Icon }) => (
          <NavItem key={r.name} active={route.name === r.name} onClick={() => navigate(r)}>
            <Icon className="size-[18px]" strokeWidth={route.name === r.name ? 2.25 : 1.75} />
            {label}
          </NavItem>
        ))}
      </nav>

      <div className="mt-8 px-6 pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Artistes</div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3">
        {artists.map((a) => (
          <NavItem
            key={a.id}
            active={route.name === "artist" && route.id === a.id}
            onClick={() => navigate({ name: "artist", id: a.id })}
          >
            <Artwork hue={a.hue} round className="size-7 shadow-none" />
            <span className="truncate">{a.name}</span>
          </NavItem>
        ))}
      </div>

      <div className="border-t border-line p-3">
        <NavItem active={route.name === "settings"} onClick={() => navigate({ name: "settings" })}>
          <Artwork hue={profile.hue} round label={initials(profile.displayName)} className="size-7 shadow-none" />
          <span className="flex-1 truncate">{profile.displayName}</span>
          <Settings className="size-4 text-faint" />
        </NavItem>
      </div>
    </aside>
  );
}

function NavItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] font-medium transition-colors duration-100",
        active ? "bg-white/[0.06] text-fg" : "text-muted hover:bg-white/[0.03] hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
