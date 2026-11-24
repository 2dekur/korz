/** Seconds to `m:ss`. Non-finite input (unknown duration) renders as `-:--`. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "-:--";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Lowercase, accent-free form used for strict local search. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Stable hue for placeholder artwork, so an album keeps its colour between sessions. */
export function hueFromSeed(seed: string): number {
  // FNV-1a: neighbouring names still get distinct colours.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  return (h >>> 0) % 360;
}

/** Milliseconds to a compact French duration: `42 min`, `1 h 05`. */
export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
