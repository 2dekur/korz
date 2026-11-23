import { useState } from "react";
import { ExternalLink, KeyRound } from "lucide-react";
import { activateLicense } from "@/store/license";
import { Logo } from "@/components/ui/Logo";

export function ActivationScreen() {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!key.trim()) return;
    setLoading(true);
    setError("");
    const res = await activateLicense(key);
    if (!res.ok) setError(res.error ?? "Clé invalide");
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-bg">
      <Logo className="mb-10 size-14" />
      <h1 className="mb-1 font-display text-[28px] font-bold tracking-[-0.02em]">Activer Korz</h1>
      <p className="mb-8 text-[14px] text-muted">Entre ta clé de licence pour démarrer.</p>

      <div className="w-full max-w-xs">
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder="KORZ-XXXX-XXXX-XXXX-XXXX"
            className="w-full rounded-lg border border-line bg-surface py-3 pl-10 pr-4 font-mono text-[13px] uppercase tracking-widest outline-none focus:border-accent"
          />
        </div>

        {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}

        <button
          onClick={() => void submit()}
          disabled={loading || !key.trim()}
          className="mt-3 w-full rounded-lg bg-accent py-3 font-semibold text-bg transition-opacity disabled:opacity-40"
        >
          {loading ? "Vérification…" : "Activer"}
        </button>
      </div>

      <a
        href="https://discord.gg/korz"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 flex items-center gap-2 text-[13px] text-muted hover:text-fg"
      >
        <ExternalLink className="size-3.5" />
        Obtenir une clé sur Discord
      </a>
    </div>
  );
}
