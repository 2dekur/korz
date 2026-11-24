import { PlugZap } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PROVIDER_NAMES } from "./ImportPage";

const NOTES: Record<keyof typeof PROVIDER_NAMES, string> = {
  spotify: "API Web officielle et compte Spotify ; lecture intégrale réservée au SDK officiel avec abonnement Premium.",
  youtube: "API YouTube Data officielle pour les métadonnées ; la lecture doit passer par le lecteur officiel.",
  deezer: "API publique officielle pour les métadonnées et les playlists de l'utilisateur.",
  "apple-music": "MusicKit, avec un compte développeur Apple et un abonnement de l'utilisateur.",
  soundcloud: "API officielle, accès soumis à l'approbation de SoundCloud.",
};

export function ServicesPage() {
  return (
    <>
      <PageHeader title="Services connectés" subtitle="Aucun service n'est connectable dans la version 0.0.1. Le lecteur local fonctionne sans eux." />
      <ul className="max-w-[720px] divide-y divide-line rounded-xl ring-1 ring-line">
        {(Object.keys(PROVIDER_NAMES) as (keyof typeof PROVIDER_NAMES)[]).map((id) => (
          <li key={id} className="flex items-start gap-4 px-5 py-4">
            <PlugZap className="mt-0.5 size-4 shrink-0 text-faint" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium">{PROVIDER_NAMES[id]}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-muted">Non disponible</span>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{NOTES[id]}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
