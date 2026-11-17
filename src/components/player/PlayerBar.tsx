import { useState } from "react";
import { ListMusic, Loader2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import { useUi } from "@/store/ui";
import { formatTime } from "@/lib/format";
import { usePlayer, useCurrentTrack } from "@/store/player";
import { Slider } from "@/components/ui/Slider";
import { Tooltip } from "@/components/ui/Tooltip";
import { IconButton } from "@/components/ui/IconButton";
import { Artwork } from "@/components/ui/Artwork";
import { ArtistLinks } from "@/components/track/ArtistLinks";
import { LikeButton } from "@/components/track/LikeButton";

export function PlayerBar() {
  return (
    <footer className="col-span-full grid h-[88px] grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-6 border-t border-line bg-surface px-4">
      <NowPlaying />
      <Transport />
      <VolumeControl />
    </footer>
  );
}

function NowPlaying() {
  const track = useCurrentTrack();
  if (!track) return <div className="text-[13px] text-faint">Aucune lecture en cours</div>;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Artwork src={track.cover} seed={track.id} className="size-14" />
      <div className="min-w-0">
        <div className="truncate text-[14px] font-medium text-fg">{track.title}</div>
        <ArtistLinks artists={track.artists} className="text-[12px]" />
      </div>
      <LikeButton track={track} />
    </div>
  );
}

function Transport() {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const resolving = usePlayer((s) => s.resolving);
  const hasTrack = usePlayer((s) => s.index >= 0);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const { toggle, next, prev, toggleShuffle, cycleRepeat } = usePlayer.getState();
  const repeatLabel = repeat === "off" ? "Répéter" : repeat === "all" ? "Répéter le titre" : "Désactiver la répétition";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-4">
        <Tooltip label={shuffle ? "Désactiver la lecture aléatoire" : "Lecture aléatoire"}>
          <IconButton label={shuffle ? "Désactiver la lecture aléatoire" : "Lecture aléatoire"} active={shuffle} aria-pressed={shuffle} onClick={toggleShuffle}>
            <Shuffle className="size-4" />
          </IconButton>
        </Tooltip>
        <Tooltip label="Précédent">
          <IconButton label="Précédent" onClick={prev} disabled={!hasTrack}>
            <SkipBack className="size-[18px] fill-current" />
          </IconButton>
        </Tooltip>
        <Tooltip label={isPlaying ? "Pause" : "Lecture"}>
          <button
            type="button"
            aria-label={isPlaying ? "Pause" : "Lecture"}
            onClick={toggle}
            disabled={!hasTrack}
            className="flex size-9 items-center justify-center rounded-full bg-fg text-bg transition-transform duration-150 hover:scale-[1.06] active:scale-95 disabled:opacity-30"
          >
            {resolving ? (
              <Loader2 className="size-4 animate-spin" aria-label="Chargement du flux" />
            ) : isPlaying ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="ml-0.5 size-4 fill-current" />
            )}
          </button>
        </Tooltip>
        <Tooltip label="Suivant">
          <IconButton label="Suivant" onClick={next} disabled={!hasTrack}>
            <SkipForward className="size-[18px] fill-current" />
          </IconButton>
        </Tooltip>
        <Tooltip label={repeatLabel}>
          <IconButton label={repeatLabel} active={repeat !== "off"} onClick={cycleRepeat}>
            {repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
          </IconButton>
        </Tooltip>
      </div>
      <Progress disabled={!hasTrack} />
    </div>
  );
}

/** While dragging, the slider shows the local value; audio only seeks on release. */
function Progress({ disabled }: { disabled: boolean }) {
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const seek = usePlayer((s) => s.seek);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? position;
  return (
    <div className="flex w-full max-w-[600px] items-center gap-2 text-[11px] tabular-nums text-faint">
      <span className="w-10 text-right">{formatTime(disabled ? NaN : shown)}</span>
      <Slider
        label="Position de lecture"
        value={shown}
        max={duration}
        step={0.1}
        disabled={disabled || !duration}
        onChange={setDrag}
        onCommit={(v) => {
          seek(v);
          setDrag(null);
        }}
      />
      <span className="w-10">{formatTime(duration || NaN)}</span>
    </div>
  );
}

function VolumeControl() {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const { setVolume, toggleMute } = usePlayer.getState();
  const level = muted ? 0 : volume;
  const Icon = level === 0 ? VolumeX : level < 0.33 ? Volume : level < 0.66 ? Volume1 : Volume2;
  return (
    <div className="flex items-center justify-end gap-2">
      <QueueToggle />
      <Tooltip label={muted ? "Réactiver le son" : "Couper le son"}>
        <IconButton label={muted ? "Réactiver le son" : "Couper le son"} onClick={toggleMute}>
          <Icon className="size-[18px]" />
        </IconButton>
      </Tooltip>
      <Slider label="Volume" value={level} max={1} onChange={setVolume} className="w-28" />
    </div>
  );
}

function QueueToggle() {
  const open = useUi((s) => s.queueOpen);
  return (
    <Tooltip label="File d'attente">
      <IconButton label="File d'attente" active={open} aria-pressed={open} onClick={useUi.getState().toggleQueue} className="mr-2">
        <ListMusic className="size-[18px]" />
      </IconButton>
    </Tooltip>
  );
}
