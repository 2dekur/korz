import { useState } from "react";
import { Info, Link2 } from "lucide-react";
import { openLink } from "@/store/smartlink";
import { useNavigation } from "@/store/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";

export function ImportPage() {
  const [url, setUrl] = useState("");
  const navigate = useNavigation((s) => s.navigate);
  return (
    <>
      <PageHeader title="Importer un lien" subtitle="Collez un lien ici ou directement dans la barre de recherche." />
      <form
        className="flex max-w-[640px] gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void openLink(url);
        }}
      >
        <label className="relative flex flex-1 items-center">
          <Link2 className="pointer-events-none absolute left-3 size-4 text-faint" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            aria-label="Lien à analyser"
            spellCheck={false}
            className="h-10 w-full rounded-lg bg-white/[0.06] pl-9 pr-3 text-[13px] outline-none ring-1 ring-white/10 focus:ring-white/30"
          />
        </label>
        <Button type="submit" variant="primary" disabled={!url.trim()} className="h-10">
          Analyser
        </Button>
      </form>

      <dl className="mt-8 grid max-w-[640px] grid-cols-[150px_1fr] gap-x-4 gap-y-3 text-[13px]">
        <dt className="font-medium">Lien audio direct</dt>
        <dd className="text-muted">Fichier MP3, FLAC, WAV, AAC, M4A ou OGG : lecture, file d'attente ou import permanent dans votre bibliothèque.</dd>
        <dt className="font-medium">YouTube, Spotify</dt>
        <dd className="text-muted">Titre et artiste lus via leurs informations publiques, puis lecture du morceau correspondant de votre bibliothèque.</dd>
        <dt className="font-medium">Autres services</dt>
        <dd className="text-muted">Deezer, Apple Music et SoundCloud sont reconnus, pas encore pris en charge.</dd>
      </dl>

      <div className="mt-8 flex max-w-[640px] gap-3 rounded-xl p-4 text-[13px] leading-relaxed text-muted ring-1 ring-line">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          KORZ ne télécharge que des fichiers audio publiés en lien direct, et ne lit ni ne télécharge jamais le contenu de YouTube ou Spotify. Le
          comportement au collage d'un lien se règle dans{" "}
          <button type="button" onClick={() => navigate({ name: "settings" })} className="text-fg underline-offset-2 hover:underline">
            Paramètres
          </button>
          .
        </p>
      </div>
    </>
  );
}
