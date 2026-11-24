import { useEffect } from "react";
import { Toaster } from "sonner";
import { api } from "@/services/api";
import { useRoute } from "@/store/navigation";
import { command } from "@/store/player";
import { AppShell } from "@/components/layout/AppShell";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { HomePage } from "@/pages/HomePage";
import { SearchPage } from "@/pages/SearchPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { AlbumPage } from "@/pages/AlbumPage";
import { ArtistPage } from "@/pages/ArtistPage";
import { PlaylistsPage } from "@/pages/PlaylistsPage";
import { PlaylistPage } from "@/pages/PlaylistPage";
import { FavoritesPage } from "@/pages/FavoritesPage";
import { ImportPage } from "@/pages/ImportPage";
import { ServicesPage } from "@/pages/ServicesPage";
import { SettingsPage } from "@/pages/SettingsPage";

function CurrentPage() {
  const route = useRoute();
  switch (route.name) {
    case "home":
      return <HomePage />;
    case "search":
      return <SearchPage />;
    case "library":
      return <LibraryPage tab={route.tab} />;
    case "album":
      return <AlbumPage title={route.title} artist={route.artist} />;
    case "artist":
      return <ArtistPage artist={route.artist} />;
    case "playlists":
      return <PlaylistsPage />;
    case "playlist":
      return <PlaylistPage id={route.id} />;
    case "favorites":
      return <FavoritesPage />;
    case "import":
      return <ImportPage />;
    case "services":
      return <ServicesPage />;
    case "settings":
      return <SettingsPage />;
  }
}

/** Space toggles playback, except while typing or when a button has focus (Space activates it). */
function useSpaceToToggle() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code !== "Space" || e.repeat || el.closest("input, textarea, button, [role=slider], [contenteditable]")) return;
      e.preventDefault();
      command(api.toggle);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export default function App() {
  useSpaceToToggle();
  return (
    <TooltipProvider delayDuration={500} skipDelayDuration={200}>
      <AppShell>
        <CurrentPage />
      </AppShell>
      <Toaster
        theme="dark"
        position="bottom-right"
        offset={{ bottom: 100, right: 20 }}
        toastOptions={{
          className: "!bg-raised !text-fg !ring-1 !ring-line !border-0 !rounded-xl !font-sans !shadow-[0_16px_40px_rgb(0_0_0/0.5)]",
          descriptionClassName: "!text-muted",
        }}
      />
    </TooltipProvider>
  );
}
