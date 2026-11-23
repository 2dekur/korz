import { useState } from "react";
import type { Config } from "../App";

const DURATIONS = [
  { label: "1 jour", days: 1 },
  { label: "7 jours", days: 7 },
  { label: "30 jours", days: 30 },
  { label: "Lifetime", days: null },
] as const;

export function KeyGenerator({
  config,
  onGenerated,
}: {
  config: Config;
  onGenerated: (keys: string[]) => void;
}) {
  const [duration, setDuration] = useState<number | null>(30);
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${config.workerUrl}/admin/keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.adminToken}`,
        },
        body: JSON.stringify({ duration_days: duration, count }),
      });
      const data = (await res.json()) as { keys?: string[]; error?: string };
      if (data.keys) {
        onGenerated(data.keys);
      } else {
        setError(data.error ?? "Erreur");
      }
    } catch {
      setError("Impossible de joindre le serveur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-4 text-[16px] font-semibold">Générer des clés</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {DURATIONS.map((d) => (
          <button
            key={String(d.days)}
            onClick={() => setDuration(d.days)}
            className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
              duration === d.days
                ? "bg-accent text-bg"
                : "bg-raised text-muted hover:text-fg"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[13px] text-muted">Quantité</label>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value))))}
            className="w-16 rounded-lg border border-line bg-raised px-2 py-1.5 text-center text-[13px] outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={() => void generate()}
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-bg disabled:opacity-40"
        >
          {loading ? "Génération…" : "Générer"}
        </button>
        {error && <span className="text-[12px] text-red-400">{error}</span>}
      </div>
    </div>
  );
}
