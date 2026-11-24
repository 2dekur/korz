import { ListEnd, ListPlus, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Track } from "@/types";
import { api, errorMessage } from "@/services/api";
import { command } from "@/store/player";
import { useLibrary } from "@/store/library";
import { useQuery } from "@/hooks/useQuery";
import { cn } from "@/lib/cn";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/Menu";

export function TrackMenu({ track, onRemove, className }: { track: Track; onRemove?: () => void; className?: string }) {
  return (
    <Menu
      label={`Actions pour ${track.title}`}
      trigger={(open, active) => (
        <button
          type="button"
          aria-label={`Plus d'actions pour ${track.title}`}
          aria-haspopup="menu"
          aria-expanded={active}
          onClick={open}
          className={cn("flex size-7 items-center justify-center rounded-full text-muted transition hover:text-fg", active && "text-fg opacity-100", className)}
        >
          <MoreHorizontal className="size-[18px]" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuItem
            onSelect={() => {
              command(() => api.enqueue([track.id]));
              close();
            }}
          >
            <ListEnd className="size-4 text-muted" /> Ajouter à la file d'attente
          </MenuItem>
          {onRemove && (
            <MenuItem
              onSelect={() => {
                onRemove();
                close();
              }}
            >
              <Trash2 className="size-4 text-muted" /> Retirer de cette playlist
            </MenuItem>
          )}
          <MenuLabel>Ajouter à une playlist</MenuLabel>
          <PlaylistTargets track={track} close={close} />
        </>
      )}
    </Menu>
  );
}

function PlaylistTargets({ track, close }: { track: Track; close: () => void }) {
  const playlists = useQuery(() => api.playlists(), []);
  const add = async (id: number, name: string) => {
    close();
    try {
      await api.addToPlaylist(id, [track.id]);
      useLibrary.getState().bump();
      toast.success(`Ajouté à « ${name} »`);
    } catch (err) {
      toast.error("Ajout impossible", { description: errorMessage(err) });
    }
  };
  const create = async () => {
    close();
    try {
      const p = await api.createPlaylist(track.album || "Nouvelle playlist");
      await add(p.id, p.name);
    } catch (err) {
      toast.error("Création impossible", { description: errorMessage(err) });
    }
  };
  return (
    <div className="max-h-[240px] overflow-y-auto">
      {playlists.data?.map((p) => (
        <MenuItem key={p.id} onSelect={() => void add(p.id, p.name)}>
          <ListPlus className="size-4 text-muted" /> <span className="truncate">{p.name}</span>
        </MenuItem>
      ))}
      <MenuItem onSelect={() => void create()}>
        <Plus className="size-4 text-muted" /> Nouvelle playlist
      </MenuItem>
    </div>
  );
}
