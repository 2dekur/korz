import { create } from "zustand";

interface UiState {
  queueOpen: boolean;
  search: string;
  toggleQueue: () => void;
  setSearch: (search: string) => void;
}

export const useUi = create<UiState>((set) => ({
  queueOpen: false,
  search: "",
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
  setSearch: (search) => set({ search }),
}));
