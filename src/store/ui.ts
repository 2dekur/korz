import { create } from "zustand";

/** Layout state that is not a route: side panels. */
export const useUi = create<{ queueOpen: boolean; toggleQueue: () => void }>((set) => ({
  queueOpen: false,
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
}));
