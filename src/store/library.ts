import { create } from "zustand";
import { toast } from "sonner";
import { api, errorMessage, events } from "@/services/api";
import type { ScanProgress, ScanSummary } from "@/types";

interface LibraryState {
  /** Bumped after any write; every query re-runs when it changes. */
  revision: number;
  scanning: ScanProgress | null;
  bump: () => void;
}

export const useLibrary = create<LibraryState>((set) => ({
  revision: 0,
  scanning: null,
  bump: () => set((s) => ({ revision: s.revision + 1 })),
}));

export async function initLibraryEvents() {
  await events.scanProgress((p) => useLibrary.setState({ scanning: p }));
}

function describe(s: ScanSummary): string {
  const parts = [`${s.added} ajouté${s.added > 1 ? "s" : ""}`];
  if (s.updated) parts.push(`${s.updated} mis à jour`);
  if (s.removed) parts.push(`${s.removed} retiré${s.removed > 1 ? "s" : ""}`);
  if (s.failed) parts.push(`${s.failed} illisible${s.failed > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

/** Runs a scan command, reports the outcome and refreshes every view. */
export async function runScan(task: () => Promise<ScanSummary>) {
  try {
    const summary = await task();
    toast.success("Bibliothèque à jour", { description: describe(summary) });
  } catch (err) {
    toast.error("Analyse impossible", { description: errorMessage(err) });
  } finally {
    useLibrary.setState((s) => ({ scanning: null, revision: s.revision + 1 }));
  }
}

export async function toggleFavorite(trackId: number) {
  try {
    const favorite = await api.toggleFavorite(trackId);
    useLibrary.getState().bump();
    return favorite;
  } catch (err) {
    toast.error("Favori non enregistré", { description: errorMessage(err) });
    return null;
  }
}
