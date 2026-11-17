import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { isTauri } from "@tauri-apps/api/core";
import { platform, version as osVersion } from "@tauri-apps/plugin-os";
import { Check } from "lucide-react";
import { toast } from "sonner";
import type { AudioQuality } from "@/types";
import { cn } from "@/lib/cn";
import { useSettings } from "@/store/settings";
import { Switch } from "@/components/ui/Switch";
import { Artwork, initials } from "@/components/ui/Artwork";
import pkg from "../../package.json";

const QUALITIES: { value: AudioQuality; label: string; detail: string }[] = [
  { value: "low", label: "Basse", detail: "96 kbit/s" },
  { value: "normal", label: "Normale", detail: "160 kbit/s" },
  { value: "high", label: "Haute", detail: "320 kbit/s" },
  { value: "lossless", label: "Sans perte", detail: "FLAC 16-bit" },
];

const HUES = [262, 210, 188, 150, 84, 42, 16, 330];

const system = isTauri() ? `${platform()} ${osVersion()}` : "navigateur (aperçu web)";

export function SettingsPage() {
  const { audioQuality, sources, hardwareAcceleration, profile, update, updateProfile } = useSettings();
  const [name, setName] = useState(profile.displayName);

  const commitName = () => {
    const trimmed = name.trim().slice(0, 32);
    if (!trimmed) return setName(profile.displayName);
    if (trimmed !== profile.displayName) updateProfile({ displayName: trimmed });
    setName(trimmed);
  };

  return (
    <div className="mx-auto max-w-[760px] px-8 pb-16 pt-20">
      <h1 className="font-display text-[32px] font-bold tracking-[-0.025em]">Paramètres</h1>
      <p className="mt-1 text-[13px] text-muted">Les modifications sont enregistrées automatiquement.</p>

      <Section title="Profil local">
        <div className="flex items-center gap-5 p-5">
          <Artwork hue={profile.hue} round label={initials(profile.displayName)} className="size-16" />
          <div className="flex-1">
            <label htmlFor="display-name" className="text-[12px] font-medium text-muted">
              Nom affiché
            </label>
            <input
              id="display-name"
              value={name}
              maxLength={32}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="mt-1.5 h-10 w-full rounded-md bg-white/[0.05] px-3 text-[14px] text-fg ring-1 ring-line transition focus:bg-white/[0.07] focus-visible:outline-none focus:ring-white/20"
            />
          </div>
        </div>
        <Row title="Couleur de l'avatar">
          <div className="flex gap-2" role="radiogroup" aria-label="Couleur de l'avatar">
            {HUES.map((h) => (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={profile.hue === h}
                aria-label={`Teinte ${h}`}
                onClick={() => updateProfile({ hue: h })}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition",
                  profile.hue === h ? "ring-2 ring-fg" : "hover:scale-110",
                )}
                style={{ background: `hsl(${h} 70% 55%)` }}
              >
                {profile.hue === h && <Check className="size-3.5 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="Audio">
        <div className="p-5">
          <div className="text-[14px] font-medium">Qualité de streaming</div>
          <div className="mt-0.5 text-[13px] text-muted">Une qualité supérieure consomme plus de bande passante.</div>
          <div className="mt-4 grid grid-cols-4 gap-1 rounded-lg bg-black/30 p-1" role="radiogroup" aria-label="Qualité audio">
            {QUALITIES.map((q) => (
              <button
                key={q.value}
                type="button"
                role="radio"
                aria-checked={audioQuality === q.value}
                onClick={() => update({ audioQuality: q.value })}
                className={cn(
                  "rounded-md px-3 py-2 text-left transition-colors duration-150",
                  audioQuality === q.value ? "bg-white/[0.09] text-fg shadow-[0_1px_2px_rgb(0_0_0/0.3)]" : "text-muted hover:text-fg",
                )}
              >
                <div className="text-[13px] font-semibold">{q.label}</div>
                <div className="text-[11px] tabular-nums text-faint">{q.detail}</div>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Sources audio">
        <Row
          title="Lecteur Global"
          description="Lecture intégrale de chaque titre : la version officielle est trouvée sur votre ordinateur (même artiste, durée à ±4 s, sans remix ni live), puis diffusée via le réseau de relais. Si un relais tarde plus de 1,5 s, le suivant prend le relais."
          htmlFor="src-full"
        >
          <Switch id="src-full" checked={sources.fullStream} onCheckedChange={(v) => update({ sources: { ...sources, fullStream: v } })} />
        </Row>
        <Row title="Fichiers locaux" description="Dossiers ajoutés dans la Bibliothèque. Toujours prioritaires pour leurs propres titres.">
          <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-medium text-muted">Toujours actif</span>
        </Row>
        <Row
          title="Extraits en dernier recours"
          description="Joue l'extrait de 30 s uniquement si aucune version complète n'a pu démarrer."
          htmlFor="src-preview"
        >
          <Switch
            id="src-preview"
            checked={sources.previewFallback}
            onCheckedChange={(v) => update({ sources: { ...sources, previewFallback: v } })}
          />
        </Row>
      </Section>

      <Section title="Système">
        <Row
          title="Accélération matérielle"
          description="Utilise le GPU pour le rendu. Désactivez en cas d'artefacts graphiques. Prend effet au prochain démarrage."
          htmlFor="hw-accel"
        >
          <Switch
            id="hw-accel"
            checked={hardwareAcceleration}
            onCheckedChange={(v) => {
              update({ hardwareAcceleration: v });
              toast("Redémarrage requis", { description: "Relancez Korz pour appliquer ce changement." });
            }}
          />
        </Row>
        <Row title="Réinitialiser les préférences" description="Rétablit les réglages et le profil par défaut.">
          <ResetDialog onReset={() => setName(useSettings.getState().profile.displayName)} />
        </Row>
      </Section>

      <p className="mt-10 text-center text-[12px] text-faint">
        Korz {pkg.version} · {system}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-xl bg-surface ring-1 ring-line">{children}</div>
    </section>
  );
}

function Row({ title, description, htmlFor, children }: { title: string; description?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-8 p-5">
      <div>
        <label htmlFor={htmlFor} className="text-[14px] font-medium">
          {title}
        </label>
        {description && <div className="mt-0.5 max-w-[420px] text-[13px] text-muted">{description}</div>}
      </div>
      {children}
    </div>
  );
}

function ResetDialog({ onReset }: { onReset: () => void }) {
  const reset = useSettings((s) => s.reset);
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="h-8 shrink-0 rounded-full px-4 text-[13px] font-medium text-fg ring-1 ring-white/15 transition hover:bg-white/[0.06]">
          Réinitialiser
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-raised p-6 shadow-[0_24px_64px_rgb(0_0_0/0.6)] ring-1 ring-line data-[state=open]:animate-[pop-in_180ms_cubic-bezier(0.22,1,0.36,1)]">
          <Dialog.Title className="font-display text-[18px] font-bold">Réinitialiser les préférences ?</Dialog.Title>
          <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-muted">
            Qualité audio, sources audio, accélération matérielle et profil local reviendront à leurs valeurs par défaut.
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button type="button" className="h-9 rounded-full px-4 text-[13px] font-medium text-muted transition hover:text-fg">
                Annuler
              </button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <button
                type="button"
                onClick={() => {
                  reset();
                  onReset();
                  toast.success("Préférences réinitialisées");
                }}
                className="h-9 rounded-full bg-fg px-4 text-[13px] font-semibold text-bg transition hover:scale-[1.03] active:scale-95"
              >
                Réinitialiser
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
