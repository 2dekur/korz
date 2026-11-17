import { create } from "zustand";
import { toast } from "sonner";
import { isTauri } from "@tauri-apps/api/core";
import type { Artist, Track } from "@/types";
import { readKey, writeKey } from "@/services/persist";
import { scanFolder } from "@/services/localFiles";

interface LibraryData {
  liked: Track[];
  followed: Artist[];
  folders: string[];
}

interface LibraryState extends LibraryData {
  local: Track[];
  scanning: boolean;
  toggleLike: (track: Track) => void;
  toggleFollow: (artist: Artist) => void;
  addFolder: (path: string) => Promise<void>;
  removeFolder: (path: string) => void;
  rescan: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const isArray = (v: unknown): v is unknown[] => Array.isArray(v);

export const useLibrary = create<LibraryState>((set, get) => ({
  liked: [],
  followed: [],
  folders: [],
  local: [],
  scanning: false,

  toggleLike: (track) => {
    const liked = get().liked;
    if (liked.some((t) => t.id === track.id)) {
      set({ liked: liked.filter((t) => t.id !== track.id) });
      toast("Retiré des Titres likés");
    } else {
      set({ liked: [track, ...liked] });
      toast("Ajouté aux Titres likés");
    }
  },

  toggleFollow: (artist) => {
    const followed = get().followed;
    const { id, name, picture, pictureLarge, fans } = artist;
    set({
      followed: followed.some((a) => a.id === id)
        ? followed.filter((a) => a.id !== id)
        : [{ id, name, picture, pictureLarge, fans }, ...followed],
    });
  },

  addFolder: async (path) => {
    if (get().folders.includes(path)) {
      toast("Dossier déjà ajouté");
      return;
    }
    set({ folders: [...get().folders, path] });
    await get().rescan();
  },

  removeFolder: (path) => {
    const prefix = `local:${path}`;
    set({ folders: get().folders.filter((f) => f !== path), local: get().local.filter((t) => !t.id.startsWith(prefix)) });
  },

  rescan: async () => {
    if (get().scanning || !isTauri()) return;
    set({ scanning: true });
    try {
      const results = await Promise.allSettled(get().folders.map(scanFolder));
      const local = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      const failed = results.filter((r) => r.status === "rejected").length;
      set({ local });
      if (failed) toast.error(`${failed} dossier(s) illisible(s)`, { description: "Réajoutez-les depuis la Bibliothèque." });
      else toast.success(`${local.length} fichier(s) audio trouvé(s)`);
    } finally {
      set({ scanning: false });
    }
  },

  hydrate: async () => {
    const [data, local] = await Promise.all([readKey<Partial<LibraryData>>("library"), readKey<Track[]>("localTracks")]);
    // Persisted file is user-editable: keep only well-formed arrays.
    set({
      liked: isArray(data?.liked) ? (data.liked as Track[]) : [],
      followed: isArray(data?.followed) ? (data.followed as Artist[]) : [],
      folders: isArray(data?.folders) ? (data.folders.filter((f) => typeof f === "string") as string[]) : [],
      local: isArray(local) ? local : [],
    });
  },
}));

let timer: ReturnType<typeof setTimeout> | undefined;
useLibrary.subscribe((s, prev) => {
  if (s.liked === prev.liked && s.followed === prev.followed && s.folders === prev.folders && s.local === prev.local) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    void writeKey("library", { liked: s.liked, followed: s.followed, folders: s.folders });
    if (s.local !== prev.local) void writeKey("localTracks", s.local);
  }, 300);
});

export const useIsLiked = (id: string) => useLibrary((s) => s.liked.some((t) => t.id === id));
export const useIsFollowed = (id: string) => useLibrary((s) => s.followed.some((a) => a.id === id));
