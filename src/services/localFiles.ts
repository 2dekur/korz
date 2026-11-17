import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import type { Track } from "@/types";
import { AUDIO_FILE, trackFromFile } from "@/lib/music";

/** Folder picker. The dialog plugin grants fs + asset-protocol access to the chosen folder (persisted-scope keeps it). */
export async function pickFolder(): Promise<string | null> {
  const picked = await open({ directory: true, recursive: true, title: "Ajouter un dossier de musique" });
  return typeof picked === "string" ? picked : null;
}

const MAX_DEPTH = 12;

export async function scanFolder(root: string): Promise<Track[]> {
  const sep = root.includes("\\") ? "\\" : "/";
  const out: Track[] = [];
  const walk = async (dir: string, depth: number): Promise<void> => {
    const entries = await readDir(dir);
    const subdirs: Promise<void>[] = [];
    for (const e of entries) {
      const path = `${dir.replace(/[\\/]$/, "")}${sep}${e.name}`;
      // Symlinked folders are skipped to avoid cycles.
      if (e.isDirectory && !e.isSymlink && depth < MAX_DEPTH) subdirs.push(walk(path, depth + 1).catch(() => {}));
      else if (e.isFile && AUDIO_FILE.test(e.name)) out.push(trackFromFile(path));
    }
    await Promise.all(subdirs);
  };
  await walk(root, 0);
  return out.sort((a, b) => a.src.localeCompare(b.src));
}
