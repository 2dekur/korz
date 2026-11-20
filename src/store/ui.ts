import { create } from "zustand";

export type SidePanel = "queue" | "lyrics";

/** Layout state that is not a route: one side panel at a time. */
export const useUi = create<{ panel: SidePanel | null; togglePanel: (p: SidePanel) => void }>((set) => ({
  panel: null,
  togglePanel: (p) => set((s) => ({ panel: s.panel === p ? null : p })),
}));
