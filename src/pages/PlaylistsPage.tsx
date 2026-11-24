import { useState } from "react";
import { ListMusic, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, coverUrl, errorMessage } from "@/services/api";
import { useQuery } from "@/hooks/useQuery";
import { plural } from "@/lib/format";
import { useNavigation } from "@/store/navigation";
import { useLibrary } from "@/store/library";
import { PageHeader } from "@/components/layout/PageHeader";
import { Artwork } from "@/components/ui/Artwork";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";

export function PlaylistsPage() {
  const q = useQuery(() => api.playlists(), []);
  const navigate = useNavigation((s) => s.navigate);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    try {
      const p = await api.createPlaylist(name);
      setName("");
      setCreating(false);
      useLibrary.getState().bump();
      navigate({ name: "playlist", id: p.id });
    } catch (err) {
      toast.error("Création impossible", { description: errorMessage(err) });
    }
  };

  return (
    <>
      <PageHeader title="Playlists" subtitle={q.data && plural(q.data.length, "playlist", "playlists")}>
        {!creating && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Nouvelle playlist
          </Button>
        )}
      </PageHeader>
      {creating && (
        <form
          className="mb-8 flex max-w-[460px] gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <input
            autoFocus
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setCreating(false)}
            placeholder="Nom de la playlist"
            aria-label="Nom de la playlist"
            className="h-9 flex-1 rounded-lg bg-white/[0.06] px-3 text-[13px] outline-none ring-1 ring-white/10 focus:ring-white/30"
          />
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            Créer
          </Button>
          <Button onClick={() => setCreating(false)}>Annuler</Button>
        </form>
      )}
      {q.status === "error" && <ErrorState message={q.error} />}
      {!q.data && q.status === "loading" && <Spinner />}
      {q.data?.length === 0 && !creating && (
        <EmptyState icon={ListMusic} title="Aucune playlist">
          Créez une playlist, puis ajoutez-y des titres depuis le menu « … » de chaque ligne.
        </EmptyState>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-5 gap-y-7">
        {q.data?.map((p) => (
          <button key={p.id} type="button" onClick={() => navigate({ name: "playlist", id: p.id })} className="group min-w-0 text-left">
            <Artwork src={coverUrl(p.cover)} seed={`playlist-${p.id}`} className="aspect-square w-full transition-transform duration-200 group-hover:scale-[1.02]" />
            <div className="mt-2.5 truncate text-[14px] font-medium">{p.name}</div>
            <div className="text-[12.5px] text-muted">{plural(p.trackCount, "titre", "titres")}</div>
          </button>
        ))}
      </div>
    </>
  );
}
