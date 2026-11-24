import { create } from "zustand";
import type { Route } from "@/types";

interface NavigationState {
  history: Route[];
  cursor: number;
  navigate: (route: Route) => void;
  back: () => void;
  forward: () => void;
}

const sameRoute = (a: Route, b: Route) => JSON.stringify(a) === JSON.stringify(b);

/** In-memory router: switching view is a state change, nothing is reloaded outside the page. */
export const useNavigation = create<NavigationState>((set, get) => ({
  history: [{ name: "home" }],
  cursor: 0,
  navigate: (route) => {
    const { history, cursor } = get();
    if (sameRoute(history[cursor]!, route)) return;
    set({ history: [...history.slice(0, cursor + 1), route], cursor: cursor + 1 });
  },
  back: () => set((s) => ({ cursor: Math.max(0, s.cursor - 1) })),
  forward: () => set((s) => ({ cursor: Math.min(s.history.length - 1, s.cursor + 1) })),
}));

export const useRoute = () => useNavigation((s) => s.history[s.cursor]!);
