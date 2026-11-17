import { useLayoutEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useNavigation } from "@/store/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ScrollContext } from "./ScrollContext";
import { PlayerBar } from "@/components/player/PlayerBar";
import { QueuePanel } from "@/components/player/QueuePanel";
import { useUi } from "@/store/ui";

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
      className={`grid h-screen ${queueOpen ? "grid-cols-[248px_minmax(0,1fr)_auto]" : "grid-cols-[248px_minmax(0,1fr)]"} grid-rows-[minmax(0,1fr)_auto] bg-bg text-fg`}
    >
      <Sidebar />
      <ScrollContext.Provider value={scrollRef}>
        <main ref={scrollRef} className="relative overflow-y-auto overflow-x-hidden bg-surface/40 [scrollbar-gutter:stable]">
          <TopBar />
          {/* Enter-only fade: no exit animation, so the next view is on screen in the same frame. */}
          <motion.div
            key={routeKey}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="-mt-16"
          >
            {children}
          </motion.div>
        </main>
      </ScrollContext.Provider>
      {queueOpen && <QueuePanel />}
      <PlayerBar />
    </div>
  );
}
