export interface Artist {
  id: string;
  name: string;
  genre: string;
  /** Hue (0-360) driving the generated artwork. */
  hue: number;
}

export interface Track {
  id: string;
  title: string;
  artistId: string;
  album: string;
  src: string;
  hue: number;
}

export type AudioQuality = "low" | "normal" | "high" | "lossless";

export interface Profile {
  displayName: string;
  /** Avatar hue (0-360). */
  hue: number;
}

export interface Settings {
  audioQuality: AudioQuality;
  hardwareAcceleration: boolean;
  profile: Profile;
}

export type Route =
  | { name: "home" }
  | { name: "search" }
  | { name: "library" }
  | { name: "settings" }
  | { name: "artist"; id: string };
