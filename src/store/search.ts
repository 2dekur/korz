import { create } from "zustand";

interface SearchState {
  query: string;
  /** Bumped to ask the top-bar search box to take focus. */
  focusTick: number;
  setQuery: (query: string) => void;
  focus: () => void;
}

export const useSearch = create<SearchState>((set) => ({
  query: "",
  focusTick: 0,
  setQuery: (query) => set({ query }),
  focus: () => set((s) => ({ focusTick: s.focusTick + 1 })),
}));
