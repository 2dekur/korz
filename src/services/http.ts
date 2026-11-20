import { isTauri } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

// Browser dev preview has no Rust side: requests go through the Vite dev proxy (vite.config.ts) instead.
const DEV_PROXY: [origin: string, prefix: string][] = [
  ["https://api.deezer.com", "/proxy/deezer"],
  ["https://itunes.apple.com", "/proxy/itunes"],
  ["https://lrclib.net", "/proxy/lrclib"],
  ["https://api.mymemory.translated.net", "/proxy/mymemory"],
];

/** GET JSON through Rust (`plugin-http`, no CORS). Scope: `capabilities/default.json`. */
export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  if (isTauri()) res = await tauriFetch(url, { signal });
  else {
    const hit = DEV_PROXY.find(([origin]) => url.startsWith(origin));
    res = await fetch(hit ? hit[1] + url.slice(hit[0].length) : url, { signal });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}
