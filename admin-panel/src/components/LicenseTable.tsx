import { useState } from "react";
import { Copy, PlusCircle, Ban } from "lucide-react";
import type { Config, LicenseRow } from "../App";

function ts() {
  return Math.floor(Date.now() / 1000);
}

function formatExpiry(row: LicenseRow): string {
  if (row.revoked) return "Révoquée";
  if (!row.expires_at) return "Lifetime";
  const diff = row.expires_at - ts();
  if (diff < 0) return "Expirée";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
}

type Status = "online" | "active" | "expired" | "revoked";

function getStatus(row: LicenseRow): Status {
  if (row.revoked) return "revoked";
  if (row.expires_at && row.expires_at < ts()) return "expired";
  if (row.last_seen && ts() - row.last_seen < 180) return "online";
  return "active";
}

const STATUS_LABEL: Record<Status, string> = {
  online: "En ligne",
  active: "Actif",
  expired: "Expiré",
  revoked: "Révoqué",
};

const STATUS_DOT: Record<Status, string> = {
  online: "bg-emerald-400",
  active: "bg-sky-400",
  expired: "bg-zinc-500",
  revoked: "bg-red-500",
};

export function LicenseTable({
  rows,
  config,
  onRefresh,
}: {
  rows: LicenseRow[];
  config: Config;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const patch = async (key: string, body: object) => {
    setBusy(key);
    try {
      await fetch(`${config.workerUrl}/admin/keys/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.adminToken}`,
        },
        body: JSON.stringify(body),
      });
      onRefresh();
    } finally {
      setBusy(null);
    }
  };

  const sorted = [...rows].sort((a, b) => {
    const order: Status[] = ["online", "active", "expired", "revoked"];
    return order.indexOf(getStatus(a)) - order.indexOf(getStatus(b));
  });

  if (!sorted.length) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center text-[13px] text-muted">
        Aucune licence. Génère des clés ci-dessus.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-[14px] font-semibold">Toutes les licences</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-widest text-muted">
              <th className="px-5 py-2.5">Statut</th>
              <th className="px-5 py-2.5">Clé</th>
              <th className="px-5 py-2.5">Expiration</th>
              <th className="px-5 py-2.5">Appareil</th>
              <th className="px-5 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const status = getStatus(row);
              return (
                <tr
                  key={row.key}
                  className="border-b border-line/50 hover:bg-raised/40"
                >
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} />
                      <span className="text-muted">{STATUS_LABEL[status]}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-[12px]">
                      {row.key.slice(0, 14)}…{row.key.slice(-4)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted">{formatExpiry(row)}</td>
                  <td className="px-5 py-3 font-mono text-[11px] text-muted">
                    {row.hwid ? `${row.hwid.slice(0, 8)}…` : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        aria-label="Copier la clé"
                        onClick={() => void navigator.clipboard.writeText(row.key)}
                        className="rounded p-1 text-muted hover:text-fg"
                      >
                        <Copy className="size-3.5" />
                      </button>
                      {!row.revoked && (
                        <button
                          aria-label="+7 jours"
                          disabled={busy === row.key}
                          onClick={() => void patch(row.key, { action: "extend", days: 7 })}
                          className="rounded p-1 text-muted hover:text-accent disabled:opacity-40"
                        >
                          <PlusCircle className="size-3.5" />
                        </button>
                      )}
                      {!row.revoked && (
                        <button
                          aria-label="Révoquer"
                          disabled={busy === row.key}
                          onClick={() => void patch(row.key, { action: "revoke" })}
                          className="rounded p-1 text-muted hover:text-red-400 disabled:opacity-40"
                        >
                          <Ban className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
