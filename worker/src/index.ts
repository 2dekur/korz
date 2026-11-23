export interface Env {
  DB: D1Database;
  HEARTBEATS: KVNamespace;
  ADMIN_TOKEN: string;
}

interface License {
  key: string;
  hwid: string | null;
  created_at: number;
  expires_at: number | null;
  revoked: number;
}

interface LicenseRow extends License {
  last_seen: number | null;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function requireAdmin(request: Request, env: Env): Response | null {
  const auth = request.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: "Unauthorized" }, 401);
  return null;
}

function generateKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const seg = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((b) => chars[b % chars.length])
      .join("");
  return `KORZ-${seg()}-${seg()}-${seg()}-${seg()}`;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function isExpired(lic: License): boolean {
  return lic.expires_at !== null && lic.expires_at < now();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    const path = url.pathname;

    // ── Public ───────────────────────────────────────────────────────────────

    if (path === "/activate" && request.method === "POST") {
      const { key, hwid } = (await request.json()) as { key: string; hwid: string };
      if (!key || !hwid) return json({ error: "Missing key or hwid" }, 400);

      const lic = await env.DB.prepare("SELECT * FROM licenses WHERE key = ?")
        .bind(key.trim().toUpperCase())
        .first<License>();

      if (!lic) return json({ error: "Clé introuvable" }, 404);
      if (lic.revoked) return json({ error: "Clé révoquée" }, 403);
      if (isExpired(lic)) return json({ error: "Clé expirée" }, 403);
      if (lic.hwid && lic.hwid !== hwid) return json({ error: "Clé déjà utilisée sur un autre appareil" }, 403);

      if (!lic.hwid) {
        await env.DB.prepare("UPDATE licenses SET hwid = ? WHERE key = ?").bind(hwid, lic.key).run();
      }
      await env.HEARTBEATS.put(`hb:${lic.key}`, String(now()), { expirationTtl: 300 });
      return json({ ok: true, expires_at: lic.expires_at });
    }

    if (path === "/verify" && request.method === "POST") {
      const { key, hwid } = (await request.json()) as { key: string; hwid: string };
      if (!key || !hwid) return json({ valid: false, reason: "missing" }, 400);

      const lic = await env.DB.prepare("SELECT * FROM licenses WHERE key = ?")
        .bind(key.trim().toUpperCase())
        .first<License>();

      if (!lic) return json({ valid: false, reason: "not_found" });
      if (lic.revoked) return json({ valid: false, reason: "revoked" });
      if (isExpired(lic)) return json({ valid: false, reason: "expired" });
      if (lic.hwid && lic.hwid !== hwid) return json({ valid: false, reason: "hwid_mismatch" });

      await env.HEARTBEATS.put(`hb:${lic.key}`, String(now()), { expirationTtl: 300 });
      return json({ valid: true, expires_at: lic.expires_at });
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    if (path.startsWith("/admin/")) {
      const denied = requireAdmin(request, env);
      if (denied) return denied;

      if (path === "/admin/stats" && request.method === "GET") {
        const rows = (await env.DB.prepare("SELECT * FROM licenses ORDER BY created_at DESC").all<License>()).results;
        const ts = now();
        const enriched: LicenseRow[] = await Promise.all(
          rows.map(async (r) => {
            const hb = await env.HEARTBEATS.get(`hb:${r.key}`);
            return { ...r, last_seen: hb ? Number(hb) : null };
          }),
        );
        const active = enriched.filter((r) => !r.revoked && !isExpired(r)).length;
        const expired = enriched.filter((r) => !r.revoked && isExpired(r)).length;
        const revoked = enriched.filter((r) => !!r.revoked).length;
        const online = enriched.filter((r) => r.last_seen !== null && ts - r.last_seen < 180).length;
        return json({ total: rows.length, active, expired, revoked, online, keys: enriched });
      }

      if (path === "/admin/keys" && request.method === "POST") {
        const { duration_days, count = 1 } = (await request.json()) as {
          duration_days: number | null;
          count?: number;
        };
        const qty = Math.min(Math.max(Number(count) || 1, 1), 50);
        const ts = now();
        const expires_at = duration_days != null ? ts + duration_days * 86400 : null;
        const keys: string[] = [];
        const stmt = env.DB.prepare("INSERT INTO licenses (key, created_at, expires_at) VALUES (?, ?, ?)");
        for (let i = 0; i < qty; i++) {
          const key = generateKey();
          keys.push(key);
          await stmt.bind(key, ts, expires_at).run();
        }
        return json({ keys });
      }

      const keyMatch = path.match(/^\/admin\/keys\/(.+)$/);
      if (keyMatch && request.method === "PATCH") {
        const key = decodeURIComponent(keyMatch[1] as string).toUpperCase();
        const { action, days } = (await request.json()) as { action: "revoke" | "extend"; days?: number };

        if (action === "revoke") {
          await env.DB.prepare("UPDATE licenses SET revoked = 1 WHERE key = ?").bind(key).run();
          return json({ ok: true });
        }
        if (action === "extend" && days) {
          const lic = await env.DB.prepare("SELECT * FROM licenses WHERE key = ?").bind(key).first<License>();
          if (!lic) return json({ error: "Not found" }, 404);
          const base = Math.max(lic.expires_at ?? now(), now());
          const new_expires = base + days * 86400;
          await env.DB.prepare("UPDATE licenses SET expires_at = ?, revoked = 0 WHERE key = ?")
            .bind(new_expires, key)
            .run();
          return json({ ok: true, expires_at: new_expires });
        }
        return json({ error: "Invalid action" }, 400);
      }
    }

    return json({ error: "Not found" }, 404);
  },
};
