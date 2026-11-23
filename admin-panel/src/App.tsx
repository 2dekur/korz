import { useCallback, useEffect, useRef, useState } from "react";
import { StatsPanel } from "./components/StatsPanel";
import { KeyGenerator } from "./components/KeyGenerator";
import { LicenseTable } from "./components/LicenseTable";
import { Settings, LogOut } from "lucide-react";

export interface Config {
  workerUrl: string;
  adminToken: string;
}

export interface LicenseRow {
  key: string;
  hwid: string | null;
  created_at: number;
  expires_at: number | null;
  revoked: number;
  last_seen: number | null;
}

export interface StatsData {
  total: number;
  active: number;
  expired: number;
  revoked: number;
  online: number;
  keys: LicenseRow[];
}

function loadConfig(): Config | null {
  try {
    const s = localStorage.getItem("korz-admin-config");
    return s ? (JSON.parse(s) as Config) : null;
  } catch {
    return null;
  }
}

function SetupScreen({ onSave }: { onSave: (c: Config) => void }) {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const save = () => {
    if (!url.trim() || !token.trim()) return;
    const cfg: Config = { workerUrl: url.trim().replace(/\/$/, ""), adminToken: token.trim() };
    localStorage.setItem("korz-admin-config", JSON.stringify(cfg));
    onSave(cfg);
  };
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 px-8">
      <h1 className="text-[22px] font-bold">Korz Manager</h1>
      <p className="text-[13px] text-muted">Configure l&apos;accès au serveur de licences.</p>
      <div className="mt-4 w-full max-w-sm space-y-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://korz-license.xxx.workers.dev"
          className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-[13px] outline-none focus:border-accent"
        />
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Admin token"
          className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-[13px] outline-none focus:border-accent"
        />
        <button
          onClick={save}
          disabled={!url.trim() || !token.trim()}
          className="w-full rounded-lg bg-accent py-2.5 font-semibold text-bg disabled:opacity-40"
        >
          Connexion
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(loadConfig);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState("");
  const [lastKeys, setLastKeys] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async (cfg: Config) => {
    try {
      const res = await fetch(`${cfg.workerUrl}/admin/stats`, {
        headers: { Authorization: `Bearer ${cfg.adminToken}` },
      });
      if (!res.ok) {
        setError(res.status === 401 ? "Token invalide" : `Erreur ${res.status}`);
        return;
      }
      setError("");
      setStats((await res.json()) as StatsData);
    } catch {
      setError("Impossible de joindre le serveur");
    }
  }, []);

  useEffect(() => {
    if (!config) return;
    void fetchStats(config);
    intervalRef.current = setInterval(() => void fetchStats(config), 10_000);
    return () => clearInterval(intervalRef.current ?? undefined);
  }, [config, fetchStats]);

  if (!config) return <SetupScreen onSave={setConfig} />;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-5">
        <span className="font-bold tracking-tight">Korz Manager</span>
        <div className="flex items-center gap-2">
          {error && <span className="text-[12px] text-red-400">{error}</span>}
          <button
            onClick={() => void fetchStats(config)}
            className="rounded-lg px-3 py-1.5 text-[12px] text-muted hover:text-fg"
          >
            Actualiser
          </button>
          <button
            aria-label="Paramètres de connexion"
            onClick={() => {
              localStorage.removeItem("korz-admin-config");
              setConfig(null);
              setStats(null);
            }}
            className="rounded-lg p-1.5 text-muted hover:text-fg"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left sidebar */}
        <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line p-4">
          <StatsPanel stats={stats} />
          {lastKeys.length > 0 && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">
                  Clés créées
                </span>
                <button
                  onClick={() => void navigator.clipboard.writeText(lastKeys.join("\n"))}
                  className="text-[11px] text-muted hover:text-accent"
                >
                  Copier tout
                </button>
              </div>
              <div className="space-y-1">
                {lastKeys.map((k) => (
                  <div
                    key={k}
                    className="flex items-center justify-between gap-2 rounded-md bg-raised px-2 py-1"
                  >
                    <span className="font-mono text-[11px]">{k}</span>
                    <button
                      onClick={() => void navigator.clipboard.writeText(k)}
                      className="text-[10px] text-muted hover:text-accent"
                    >
                      Copier
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
          <KeyGenerator
            config={config}
            onGenerated={(keys) => {
              setLastKeys(keys);
              void fetchStats(config);
            }}
          />
          <LicenseTable
            rows={stats?.keys ?? []}
            config={config}
            onRefresh={() => void fetchStats(config)}
          />
        </main>
      </div>
    </div>
  );
}
