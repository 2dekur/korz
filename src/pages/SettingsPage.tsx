import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { LinkBehavior, LinkSettings } from "@/types";
import { cn } from "@/lib/cn";
import { FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { api, errorMessage } from "@/services/api";
import { useQuery } from "@/hooks/useQuery";
import { plural } from "@/lib/format";
import { runScan, useLibrary } from "@/store/library";
import { checkForUpdate, installUpdate, useUpdates } from "@/store/updates";
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

      <LinksSection />

      <UpdatesSection />

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

const BEHAVIORS: { id: LinkBehavior; label: string; description: string }[] = [
  { id: "auto", label: "Automatique", description: "Lit tout de suite si la correspondance est sûre et unique ; sinon, demande." },
  { id: "always_confirm", label: "Toujours confirmer", description: "Affiche toujours la carte du lien avant d'agir." },
  { id: "instant", label: "Lecture immédiate", description: "Lit toujours la meilleure correspondance, sans demander." },
];

function LinksSection() {
  const q = useQuery(() => api.linkSettings(), []);
  const [current, setCurrent] = useState<LinkSettings | null>(null);
  const s = current ?? q.data;
  const save = async (run: () => Promise<LinkSettings>) => {
    try {
      setCurrent(await run());
    } catch (err) {
      toast.error("Réglage non enregistré", { description: errorMessage(err) });
    }
  };
  const chooseDir = async () => {
    const path = await open({ directory: true, multiple: false, title: "Choisir le dossier d'import" });
    if (typeof path === "string") await save(() => api.linkSetImportDir(path));
  };
  return (
    <Section title="Liens" description="Ce que fait KORZ quand vous collez un lien dans la recherche ou la page « Importer un lien ».">
      <div role="radiogroup" aria-label="Comportement des liens" className="flex flex-col gap-1.5">
        {BEHAVIORS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={s?.behavior === b.id}
            disabled={!s}
            onClick={() => void save(() => api.linkSetBehavior(b.id))}
            className={cn(
              "flex items-start gap-3 rounded-lg px-3.5 py-2.5 text-left ring-1 transition-colors",
              s?.behavior === b.id ? "bg-white/[0.05] ring-white/20" : "ring-line hover:bg-white/[0.03]",
            )}
          >
            <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ring-1", s?.behavior === b.id ? "ring-accent" : "ring-white/30")}>
              {s?.behavior === b.id && <span className="size-2 rounded-full bg-accent" />}
            </span>
            <span>
              <span className="block text-[13.5px] font-medium">{b.label}</span>
              <span className="block text-[12.5px] text-muted">{b.description}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <FolderOpen className="size-4 shrink-0 text-faint" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-faint">Dossier d'import des liens directs{s?.isDefaultDir ? " (par défaut)" : ""}</div>
          <div className="truncate text-[13px]">{s?.importDir ?? "…"}</div>
        </div>
        <Button onClick={() => void chooseDir()} disabled={!s}>
          Changer…
        </Button>
      </div>
      <p className="mt-2 text-[12px] text-faint">Ce dossier est ajouté à la bibliothèque au premier import.</p>
    </Section>
  );
}

function UpdatesSection() {
  const { status, update, error } = useUpdates();
  return (
    <Section title="Mises à jour" description="KORZ vérifie au lancement si une nouvelle version est publiée et vous propose de l'installer.">
      <div className="flex flex-wrap items-center gap-3">
        {status === "available" && update ? (
          <Button variant="primary" onClick={() => void installUpdate()}>
            Installer la version {update.version}
          </Button>
        ) : (
          <Button onClick={() => void checkForUpdate()} disabled={status === "checking" || status === "installing"}>
            <RefreshCw className={status === "checking" ? "size-3.5 animate-spin" : "size-3.5"} /> Rechercher une mise à jour
          </Button>
        )}
        <span className="text-[13px] text-muted" role="status">
          {status === "checking" && "Recherche…"}
          {status === "none" && "Vous avez la dernière version."}
          {status === "available" && update && `Version ${update.version} disponible (installée : ${update.current}).`}
          {status === "installing" && "Téléchargement et installation…"}
          {status === "error" && `Vérification impossible : ${error}`}
        </span>
      </div>
      {status === "available" && update?.notes && (
        <pre className="mt-4 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white/[0.04] p-4 font-sans text-[12.5px] leading-relaxed text-muted">{update.notes}</pre>
      )}
    </Section>
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
