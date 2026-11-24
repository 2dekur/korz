import { useState } from "react";
import { ListMusic, Pause, Play, SkipBack, SkipForward, Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import { formatTime } from "@/lib/format";
import { api, coverUrl } from "@/services/api";
import { command, useCurrentTrack, usePlayer } from "@/store/player";
import { useNavigation } from "@/store/navigation";
import { useUi } from "@/store/ui";
import { Slider } from "@/components/ui/Slider";
import { Tooltip } from "@/components/ui/Tooltip";
import { IconButton } from "@/components/ui/IconButton";
import { Artwork } from "@/components/ui/Artwork";
import { LikeButton } from "@/components/track/LikeButton";

export function PlayerBar() {
  return (
    <footer className="col-span-full grid h-[84px] grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] items-center gap-6 border-t border-line bg-bg px-4">
      <NowPlaying />
      <Transport />
      <Extras />
    </footer>
  );
}

function NowPlaying() {
  const track = useCurrentTrack();
  const navigate = useNavigation((s) => s.navigate);
  if (!track) return <div className="pl-2 text-[13px] text-faint">Aucune lecture en cours</div>;
  // Played from a direct link: not in the library, so no album/artist page and no favorite.
  const fromLink = track.id < 0;
  return (
    <div className="flex min-w-0 items-center gap-3">
      {fromLink ? (
        <Artwork src={coverUrl(track.cover)} seed={track.title} className="size-14" />
      ) : (
        <button type="button" aria-label={`Ouvrir l'album ${track.album}`} onClick={() => navigate({ name: "album", title: track.album, artist: track.albumArtist })}>
          <Artwork src={coverUrl(track.cover)} seed={track.album} className="size-14" />
        </button>
      )}
      <div className="min-w-0">
        <div className="truncate text-[14px] font-medium">{track.title}</div>
        {fromLink ? (
          <div className="truncate text-[12px] text-muted">Lien direct · hors bibliothèque</div>
        ) : (
          <button
            type="button"
            onClick={() => navigate({ name: "artist", artist: track.artist })}
            className="block max-w-full truncate text-[12px] text-muted hover:text-fg hover:underline"
          >
            {track.artist}
          </button>
        )}
      </div>
      {!fromLink && <LikeButton track={track} className="ml-1 shrink-0" />}
    </div>
  );
}

function Transport() {
  const playing = usePlayer((s) => s.status === "playing");
  const hasTrack = usePlayer((s) => s.index !== null);
  const label = playing ? "Pause" : "Lecture";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-5">
        <Tooltip label="Précédent">
          <IconButton label="Précédent" onClick={() => command(api.previous)} disabled={!hasTrack}>
            <SkipBack className="size-[18px] fill-current" />
          </IconButton>
        </Tooltip>
        <Tooltip label={label}>
          <button
            type="button"
            aria-label={label}
            onClick={() => command(api.toggle)}
            disabled={!hasTrack}
            className="flex size-9 items-center justify-center rounded-full bg-fg text-bg transition-transform duration-150 hover:scale-[1.06] active:scale-95 disabled:opacity-30"
          >
            {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
          </button>
        </Tooltip>
        <Tooltip label="Suivant">
          <IconButton label="Suivant" onClick={() => command(api.next)} disabled={!hasTrack}>
            <SkipForward className="size-[18px] fill-current" />
          </IconButton>
        </Tooltip>
      </div>
      <Progress disabled={!hasTrack} />
    </div>
  );
}

/** While dragging, the slider shows the local value; the engine only seeks on release. */
function Progress({ disabled }: { disabled: boolean }) {
  const position = usePlayer((s) => s.positionMs / 1000);
  // The track length is known before the first position event (and while stopped).
  const duration = usePlayer((s) => (s.index === null ? 0 : (s.queue[s.index]?.durationMs ?? 0)) / 1000);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? position;
  return (
    <div className="flex w-full max-w-[620px] items-center gap-2 text-[11px] tabular-nums text-faint">
      <span className="w-10 text-right">{formatTime(disabled ? NaN : shown)}</span>
      <Slider
        label="Position de lecture"
        value={shown}
        max={duration}
        step={0.1}
        disabled={disabled || !duration}
        onChange={setDrag}
        onCommit={(v) => {
          command(() => api.seek(v * 1000));
          setDrag(null);
        }}
      />
      <span className="w-10">{formatTime(disabled ? NaN : duration)}</span>
    </div>
  );
}

function Extras() {
  const volume = usePlayer((s) => s.volume);
  const [beforeMute, setBeforeMute] = useState(1);
  const queueOpen = useUi((s) => s.queueOpen);
  const toggleQueue = useUi((s) => s.toggleQueue);
  const Icon = volume === 0 ? VolumeX : volume < 0.33 ? Volume : volume < 0.66 ? Volume1 : Volume2;
  const muted = volume === 0;
  const setVolume = (v: number) => {
    usePlayer.setState({ volume: v });
    command(() => api.setVolume(v));
  };
  return (
    <div className="flex items-center justify-end gap-2">
      <Tooltip label="File d'attente">
        <IconButton label="File d'attente" active={queueOpen} aria-pressed={queueOpen} onClick={toggleQueue} className="mr-2">
          <ListMusic className="size-[18px]" />
        </IconButton>
      </Tooltip>
      <Tooltip label={muted ? "Réactiver le son" : "Couper le son"}>
        <IconButton
          label={muted ? "Réactiver le son" : "Couper le son"}
          onClick={() => {
            if (muted) setVolume(beforeMute || 1);
            else {
              setBeforeMute(volume);
              setVolume(0);
            }
          }}
        >
          <Icon className="size-[18px]" />
        </IconButton>
      </Tooltip>
      <Slider label="Volume" value={volume} max={1} onChange={setVolume} className="w-28" />
    </div>
  );
}
