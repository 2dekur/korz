import { isTauri } from "@tauri-apps/api/core";
import { load, type Store } from "@tauri-apps/plugin-store";

/** Key-value persistence: plugin-store in Tauri, localStorage in a plain browser (dev preview). */
let storePromise: Promise<Store> | null = null;
const getStore = () => (storePromise ??= load("settings.json", { autoSave: 100, defaults: {} }));

export async function readKey<T>(key: string): Promise<T | undefined> {
  try {
    if (isTauri()) return await (await getStore()).get<T>(key);
    const raw = localStorage.getItem(`korz:${key}`);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch (err) {
    console.error(`persist: read "${key}" failed`, err);
    return undefined;
  }
}

export async function writeKey(key: string, value: unknown): Promise<void> {
  try {
    if (isTauri()) await (await getStore()).set(key, value);
    else localStorage.setItem(`korz:${key}`, JSON.stringify(value));
  } catch (err) {
    console.error(`persist: write "${key}" failed`, err);
  }
}
