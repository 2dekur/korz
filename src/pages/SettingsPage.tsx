import { useState } from "react";
import { FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { api, errorMessage } from "@/services/api";
import { useQuery } from "@/hooks/useQuery";
import { plural } from "@/lib/format";
import { runScan, useLibrary } from "@/store/library";
import { PageHeader } from "@/components/layout/PageHeader";
import { AddFolderButton } from "@/components/library/AddFolderButton";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { ErrorState } from "@/components/ui/States";

export function SettingsPage() {
  const folders = useQuery(() => api.folders(), []);
  const info = useQuery(() => api.appInfo(), []);
  const scanning = useLibrary((s) => s.scanning !== null);
  const [confirm, setConfirm] = useState<number | null>(null);

  const remove = async (id: number) => {
    setConfirm(null);
    try {
      await api.removeFolder(id);
      useLibrary.getState().bump();
      toast.success("Dossier retiré de la bibliothèque", { description: "Les fichiers n'ont pas été touchés." });
    } catch (err) {
      toast.error("Retrait impossible", { description: errorMessage(err) });
    }
  };

  return (
    <>
      <PageHeader title="Paramètres" />

      <Section title="Dossiers de musique" description="KORZ lit ces dossiers et leurs sous-dossiers. Rien n'est déplacé, renommé ni modifié.">
        {folders.status === "error" && <ErrorState message={folders.error} />}
        {folders.data?.length === 0 && <p className="text-[13px] text-faint">Aucun dossier.</p>}
        <ul className="divide-y divide-line">
          {folders.data?.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2.5">
              <FolderOpen className="size-4 shrink-0 text-faint" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px]">{f.path}</div>
                <div className="text-[12px] text-faint">{plural(f.trackCount, "titre", "titres")}</div>
              </div>
              {confirm === f.id ? (
                <>
                  <Button variant="danger" onClick={() => void remove(f.id)}>
                    Retirer
                  </Button>
                  <Button onClick={() => setConfirm(null)}>Annuler</Button>
                </>
              ) : (
                <IconButton label={`Retirer ${f.path}`} onClick={() => setConfirm(f.id)} disabled={scanning}>
                  <Trash2 className="size-4" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <AddFolderButton />
          <Button onClick={() => void runScan(api.rescan)} disabled={scanning || !folders.data?.length}>
            <RefreshCw className="size-3.5" /> Réanalyser
          </Button>
        </div>
      </Section>

      <Section title="Formats pris en charge" description="Lecture et métadonnées vérifiées sur de vrais fichiers.">
        <p className="text-[13px] text-muted">MP3 · FLAC · WAV · AAC · M4A (AAC et ALAC) · OGG Vorbis</p>
      </Section>

      <Section title="À propos">
        {info.data && (
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-[13px]">
            <dt className="text-muted">Version</dt>
            <dd>KORZ Music {info.data.version}</dd>
            <dt className="text-muted">Données</dt>
            <dd className="truncate">{info.data.dataDir}</dd>
            <dt className="text-muted">Journaux</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <span className="truncate">{info.data.logDir}</span>
              <Button className="h-7 shrink-0 px-3" onClick={() => void revealItemInDir(info.data!.logDir).catch((e) => toast.error("Ouverture impossible", { description: errorMessage(e) }))}>
                Ouvrir
              </Button>
            </dd>
          </dl>
        )}
      </Section>
    </>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10 max-w-[760px]">
      <h2 className="font-display text-[17px] font-bold">{title}</h2>
      {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
