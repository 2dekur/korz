// Pure helpers (no Tauri imports) so they run under `node --test`.

export interface LyricLine {
  /** Seconds from the start; null for unsynced (plain) lyrics. */
  time: number | null;
  text: string;
}

const STAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

/** Parses LRC: several stamps per line, metadata tags ([ar:], [ti:]…) ignored, sorted by time. */
export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(STAMP)];
    if (!stamps.length) continue;
    const text = raw.replace(STAMP, "").trim();
    for (const [, m, s, frac = "0"] of stamps) {
      out.push({ time: Number(m) * 60 + Number(s) + Number(`0.${frac}`), text });
    }
  }
  return out.sort((a, b) => a.time! - b.time!);
}

export function parsePlain(text: string): LyricLine[] {
  return text.split(/\r?\n/).map((t) => ({ time: null, text: t.trim() }));
}

/** Index of the line being sung at `t` seconds (last line whose time ≤ t), -1 before the first one. */
export function activeLineIndex(lines: LyricLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((lines[mid]!.time ?? Infinity) <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** Groups lines into newline-joined chunks under `maxBytes` (the translation API caps each query). */
export function chunkLines(lines: string[], maxBytes = 450): string[][] {
  const size = (s: string) => new TextEncoder().encode(s).length;
  const chunks: string[][] = [];
  let current: string[] = [];
  let bytes = 0;
  for (const line of lines) {
    const b = size(line) + 1;
    if (current.length && bytes + b > maxBytes) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(line);
    bytes += b;
  }
  if (current.length) chunks.push(current);
  return chunks;
}
