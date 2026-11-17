import { create } from "zustand";
import type { AudioQuality, Profile, Settings } from "@/types";
import { readKey, writeKey } from "@/services/persist";

export const DEFAULT_SETTINGS: Settings = {
  audioQuality: "high",
  sources: { fullStream: true, previewFallback: false },
  hardwareAcceleration: true,
  profile: { displayName: "Auditeur", hue: 262 },
};

const QUALITIES: AudioQuality[] = ["low", "normal", "high", "lossless"];

/** The store file is user-editable on disk, so every field is checked before use. */
function sanitize(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (typeof raw !== "object" || raw === null) return d;
  const r = raw as Partial<Record<keyof Settings, unknown>>;
  const src = (typeof r.sources === "object" && r.sources !== null ? r.sources : {}) as Record<string, unknown>;
  const p = (typeof r.profile === "object" && r.profile !== null ? r.profile : {}) as Partial<
    Record<keyof Profile, unknown>
  >;
  return {
    audioQuality: QUALITIES.includes(r.audioQuality as AudioQuality) ? (r.audioQuality as AudioQuality) : d.audioQuality,
    sources: {
      fullStream: typeof src.fullStream === "boolean" ? src.fullStream : d.sources.fullStream,
      previewFallback: typeof src.previewFallback === "boolean" ? src.previewFallback : d.sources.previewFallback,
    },
    hardwareAcceleration: typeof r.hardwareAcceleration === "boolean" ? r.hardwareAcceleration : d.hardwareAcceleration,
    profile: {
      displayName:
        typeof p.displayName === "string" && p.displayName.trim() ? p.displayName.slice(0, 32) : d.profile.displayName,
      hue: typeof p.hue === "number" && p.hue >= 0 && p.hue < 360 ? p.hue : d.profile.hue,
    },
  };
}

interface SettingsState extends Settings {
  update: (patch: Partial<Omit<Settings, "profile">>) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  reset: () => void;
  hydrate: () => Promise<void>;
}

const pick = ({ audioQuality, sources, hardwareAcceleration, profile }: Settings): Settings => ({
  audioQuality,
  sources,
  hardwareAcceleration,
  profile,
});

export const useSettings = create<SettingsState>((set, get) => {
  const commit = (next: Settings) => {
    set(next);
    void writeKey("settings", pick(next));
  };
  return {
    ...DEFAULT_SETTINGS,
    update: (patch) => commit({ ...pick(get()), ...patch }),
    updateProfile: (patch) => commit({ ...pick(get()), profile: { ...get().profile, ...patch } }),
    reset: () => commit(DEFAULT_SETTINGS),
    hydrate: async () => set(sanitize(await readKey("settings"))),
  };
});
