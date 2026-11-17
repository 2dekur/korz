import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { useRoute } from "@/store/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { HomePage } from "@/pages/HomePage";
import { SearchPage } from "@/pages/SearchPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ArtistPage } from "@/pages/ArtistPage";

function CurrentPage() {
  const route = useRoute();
  switch (route.name) {
    case "home":
      return <HomePage />;
    case "search":
      return <SearchPage />;
    case "library":
      return <LibraryPage />;
    case "settings":
      return <SettingsPage />;
    case "artist":
      return <ArtistPage id={route.id} />;
  }
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={500} skipDelayDuration={200}>
        <AppShell>
          <CurrentPage />
        </AppShell>
        <Toaster
          theme="dark"
          position="bottom-right"
          offset={{ bottom: 104, right: 20 }}
          toastOptions={{
            className: "!bg-raised !text-fg !ring-1 !ring-line !border-0 !rounded-xl !font-sans !shadow-[0_16px_40px_rgb(0_0_0/0.5)]",
            descriptionClassName: "!text-muted",
          }}
        />
      </TooltipProvider>
    </MotionConfig>
  );
}
