import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, coverUrl, errorMessage } from "@/services/api";
import { useQuery } from "@/hooks/useQuery";
import { formatDuration, plural } from "@/lib/format";
import { playTracks } from "@/store/player";
import { useLibrary } from "@/store/library";
import { useNavigation } from "@/store/navigation";
import { CollectionHeader } from "@/components/layout/CollectionHeader";
import { TrackTable } from "@/components/track/TrackTable";
import { Button, PlayButton } from "@/components/ui/Button";
import { ErrorState, Spinner } from "@/components/ui/States";

async function attempt(title: string, run: () => Promise<void>) {
  try {
    await run();
    useLibrary.getState().bump();
  } catch (err) {
    toast.error(title, { description: errorMessage(err) });
  }
}

export function PlaylistPage({ id }: { id: number }) {
  const q = useQuery(() => api.playlist(id), [id]);
  const navigate = useNavigation((s) => s.navigate);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (q.status === "error") return <ErrorState message={q.error} />;
  if (!q.data) return <Spinner />;
  const { playlist, tracks, positions } = q.data;

  const rename = () =>
    attempt("Renommage impossible", async () => {
      await api.renamePlaylist(id, editing ?? "");
      setEditing(null);
    });

  return (
    <>
      <CollectionHeader
        kind="Playlist"
        seed={`playlist-${id}`}
        cover={coverUrl(playlist.cover)}
        title={
          editing === null ? (
            playlist.name
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void rename();
              }}
            >
              <input
                autoFocus
                value={editing}
                maxLength={100}
                onChange={(e) => setEditing(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                onBlur={() => void rename()}
                aria-label="Nouveau nom de la playlist"
                className="w-full rounded-md bg-white/[0.06] px-2 outline-none ring-1 ring-white/20"
              />
            </form>
          )
        }
        details={<span>{plural(playlist.trackCount, "titre", "titres")} · {formatDuration(playlist.durationMs)}</span>}
      >
        <PlayButton label={`Lire ${playlist.name}`} onClick={() => playTracks(tracks, 0)} disabled={!tracks.length} />
        <Button onClick={() => setEditing(playlist.name)}>
          <Pencil className="size-3.5" /> Renommer
        </Button>
        {confirmDelete ? (
          <>
            <Button
              variant="danger"
              onClick={() =>
                void attempt("Suppression impossible", async () => {
                  await api.deletePlaylist(id);
                  navigate({ name: "playlists" });
                })
              }
            >
              Confirmer la suppression
            </Button>
            <Button onClick={() => setConfirmDelete(false)}>Annuler</Button>
          </>
        ) : (
          <Button onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-3.5" /> Supprimer
          </Button>
        )}
      </CollectionHeader>
      {tracks.length === 0 ? (
        <p className="text-[13px] text-muted">Playlist vide. Ajoutez des titres depuis le menu « … » d'une ligne, dans la bibliothèque ou la recherche.</p>
      ) : (
        <TrackTable tracks={tracks} onRemove={(i) => void attempt("Retrait impossible", () => api.removeFromPlaylist(id, positions[i]!))} />
      )}
    </>
  );
}
