import type { Track } from "@/types";
import { useTrackArtists } from "@/store/credits";
import { ArtistLinks } from "./ArtistLinks";

/** Linked list of every artist of a track (main + featurings), e.g. "SDM, Ninho". */
export function TrackArtists({ track, className }: { track: Track; className?: string }) {
  return <ArtistLinks artists={useTrackArtists(track)} className={className} />;
}

/** Plain-text variant for places that are already a button (no nested links). */
export function TrackArtistNames({ track }: { track: Track }) {
  return <>{useTrackArtists(track).map((a) => a.name).join(", ")}</>;
}
