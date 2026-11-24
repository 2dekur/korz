import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useNavigation } from "@/store/navigation";
import { useUi } from "@/store/ui";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ScrollContext } from "./ScrollContext";
import { PlayerBar } from "@/components/player/PlayerBar";
import { QueuePanel } from "@/components/player/QueuePanel";

export function AppShell({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLElement>(null);
  const cursor = useNavigation((s) => s.cursor);
  const routeKey = useNavigation((s) => JSON.stringify(s.history[s.cursor]));
  const queueOpen = useUi((s) => s.queueOpen);

  // Each navigation starts at the top, like a native app switching views.
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [cursor]);

  return (
    <div
      className={cn(
        "grid h-screen grid-rows-[minmax(0,1fr)_auto] bg-bg text-fg",
        queueOpen ? "grid-cols-[232px_minmax(0,1fr)_320px]" : "grid-cols-[232px_minmax(0,1fr)]",
      )}
    >
      <Sidebar />
      <ScrollContext.Provider value={scrollRef}>
        <main ref={scrollRef} className="relative overflow-y-auto overflow-x-hidden bg-surface/50 [scrollbar-gutter:stable]">
          <TopBar />
          <div key={routeKey} className="px-8 pb-14 animate-[route-in_180ms_cubic-bezier(0.22,1,0.36,1)]">
            {children}
          </div>
        </main>
      </ScrollContext.Provider>
      {queueOpen && <QueuePanel />}
      <PlayerBar />
    </div>
  );
}
