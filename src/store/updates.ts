import { create } from "zustand";
import { isTauri } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { readKey, writeKey } from "@/services/persist";

type Status = "idle" | "checking" | "uptodate" | "available" | "downloading" | "error";

interface UpdatesState {
  current: string;
  status: Status;
  available?: { version: string; notes: string; date?: string };
  /** Download progress 0..1 (null while the size is unknown). */
  progress: number | null;
  error?: string;
  /** Versions whose popup the user closed: never shown again as a popup (Settings still offers them). */
  ignored: string[];
  toast: boolean;
  check: (opts?: { fromLaunch?: boolean }) => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
}

/** The Update handle is a live resource, so it lives outside the serialisable state. */
let pending: Update | null = null;

export const useUpdates = create<UpdatesState>((set, get) => ({
  current: "",
  status: "idle",
  progress: null,
  ignored: [],
  toast: false,

  check: async ({ fromLaunch = false } = {}) => {
    if (!isTauri() || get().status === "checking" || get().status === "downloading") return;
    set({ status: "checking", error: undefined });
    try {
      const [current, ignored, update] = await Promise.all([
        getVersion(),
        readKey<string[]>("ignoredUpdates"),
        check(),
      ]);
      const ignoredList = Array.isArray(ignored) ? ignored.filter((v) => typeof v === "string") : [];
      pending = update;
      if (!update) return set({ current, ignored: ignoredList, status: "uptodate", available: undefined });
      set({
        current,
        ignored: ignoredList,
        status: "available",
        available: { version: update.version, notes: update.body?.trim() || "Améliorations et corrections.", date: update.date },
        // The popup is a launch-time nudge only; Settings shows the update regardless.
        toast: fromLaunch && !ignoredList.includes(update.version),
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      // No published release (or a private repository) yields this message from the updater plugin.
      const error = /release JSON/i.test(raw) ? "aucune version publiée n'est accessible pour le moment" : raw;
      set({ status: "error", error, current: get().current || (await getVersion().catch(() => "")) });
    }
  },

  install: async () => {
    if (!pending) await get().check();
    if (!pending) return;
    set({ status: "downloading", progress: 0 });
    let total = 0;
    let received = 0;
    try {
      await pending.downloadAndInstall((e) => {
        if (e.event === "Started") total = e.data.contentLength ?? 0;
        if (e.event === "Progress") {
          received += e.data.chunkLength;
          set({ progress: total ? received / total : null });
        }
      });
      await relaunch();
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  },

  dismiss: () => {
    const version = get().available?.version;
    const ignored = version && !get().ignored.includes(version) ? [...get().ignored, version] : get().ignored;
    set({ toast: false, ignored });
    void writeKey("ignoredUpdates", ignored);
  },
}));
