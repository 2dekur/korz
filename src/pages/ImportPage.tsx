import { useState } from "react";
import { CircleCheck, Info, Link2 } from "lucide-react";
import { api, errorMessage } from "@/services/api";
import type { LinkInfo } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";

export const PROVIDER_NAMES: Record<LinkInfo["provider"], string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  deezer: "Deezer",
  "apple-music": "Apple Music",
  soundcloud: "SoundCloud",
};

const KIND_NAMES: Record<LinkInfo["kind"], string> = {
  track: "Titre",
  album: "Album",
  playlist: "Playlist",
  artist: "Artiste",
  video: "Vidéo",
  short: "Lien court",
};

export function ImportPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<{ ok: LinkInfo } | { error: string } | null>(null);

  const analyse = async () => {
    try {
      setResult({ ok: await api.parseLink(url) });
    } catch (err) {
      setResult({ error: errorMessage(err) });
    }
  };

  return (
    <>
      <PageHeader title="Importer un lien" subtitle="Reconnaissance des liens Spotify, YouTube, Deezer, Apple Music et SoundCloud." />
      <form
        className="flex max-w-[640px] gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void analyse();
        }}
      >
        <label className="relative flex flex-1 items-center">
          <Link2 className="pointer-events-none absolute left-3 size-4 text-faint" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://open.spotify.com/track/…"
            aria-label="Lien à analyser"
            spellCheck={false}
            className="h-10 w-full rounded-lg bg-white/[0.06] pl-9 pr-3 text-[13px] outline-none ring-1 ring-white/10 focus:ring-white/30"
          />
        </label>
        <Button type="submit" variant="primary" disabled={!url.trim()} className="h-10">
          Analyser
        </Button>
      </form>

      {result && "error" in result && <ErrorState message={result.error} />}
      {result && "ok" in result && (
        <div className="mt-6 max-w-[640px] rounded-xl bg-white/[0.04] p-5 ring-1 ring-line">
          <div className="flex items-center gap-2 text-[14px] font-semibold">
            <CircleCheck className="size-4 text-accent" /> Lien reconnu
          </div>
          <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">
            <dt className="text-muted">Service</dt>
            <dd>{PROVIDER_NAMES[result.ok.provider]}</dd>
            <dt className="text-muted">Type</dt>
            <dd>{KIND_NAMES[result.ok.kind]}</dd>
            <dt className="text-muted">Identifiant</dt>
            <dd className="truncate font-mono text-[12px]">{result.ok.id ?? "— (nécessite une résolution en ligne)"}</dd>
          </dl>
        </div>
      )}

      <div className="mt-8 flex max-w-[640px] gap-3 rounded-xl p-4 text-[13px] leading-relaxed text-muted ring-1 ring-line">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Version 0.0.1 : KORZ identifie le service, le type et l'identifiant du lien, sans contacter le service. La lecture du titre
          et de l'artiste, puis la recherche d'une correspondance dans votre bibliothèque, passeront par les API officielles de chaque
          service dans une prochaine version.
        </p>
      </div>
    </>
  );
}
