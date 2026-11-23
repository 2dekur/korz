import type { StatsData } from "../App";

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`font-mono text-[14px] font-semibold ${color ?? "text-fg"}`}>{value}</span>
    </div>
  );
}

export function StatsPanel({ stats }: { stats: StatsData | null }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
        Suivi Live
      </h2>
      <div className="space-y-2">
        <Stat label="Actives" value={stats?.active ?? "—"} color="text-accent" />
        <Stat label="En ligne" value={stats?.online ?? "—"} color="text-emerald-400" />
        <Stat label="Expirées" value={stats?.expired ?? "—"} />
        <Stat label="Révoquées" value={stats?.revoked ?? "—"} color="text-red-400" />
        <div className="my-2 border-t border-line" />
        <Stat label="Total" value={stats?.total ?? "—"} />
      </div>
    </div>
  );
}
