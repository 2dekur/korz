import { invoke, isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";
import { readKey, writeKey } from "@/services/persist";
import { LICENSE_API } from "@/lib/config";

export type LicenseStatus = "unchecked" | "valid" | "grace" | "invalid";

interface LicenseState {
  status: LicenseStatus;
  key: string | null;
  expiresAt: number | null;
}

export const useLicense = create<LicenseState>(() => ({
  status: "unchecked",
  key: null,
  expiresAt: null,
}));

async function getHwid(): Promise<string> {
  return invoke<string>("get_hwid");
}

async function callVerify(key: string, hwid: string) {
  const res = await fetch(`${LICENSE_API}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, hwid }),
  });
  return res.json() as Promise<{ valid: boolean; expires_at: number | null; reason?: string }>;
}

export async function hydrateLicense(): Promise<void> {
  if (!isTauri() || import.meta.env["VITE_NO_LICENSE"] === "true") {
    useLicense.setState({ status: "valid" });
    return;
  }
  const key = await readKey<string>("licenseKey");
  if (!key) {
    useLicense.setState({ status: "invalid" });
    return;
  }
  useLicense.setState({ key });
  try {
    const hwid = await getHwid();
    const data = await callVerify(key, hwid);
    if (data.valid) {
      useLicense.setState({ status: "valid", key, expiresAt: data.expires_at });
    } else {
      await writeKey("licenseKey", null);
      useLicense.setState({ status: "invalid", key: null });
    }
  } catch {
    // Network error: trust the stored key (grace period).
    useLicense.setState({ status: "grace", key, expiresAt: null });
  }
}

export async function activateLicense(rawKey: string): Promise<{ ok: boolean; error?: string }> {
  const key = rawKey.trim().toUpperCase();
  try {
    const hwid = await getHwid();
    const res = await fetch(`${LICENSE_API}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, hwid }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string; expires_at?: number | null };
    if (data.ok) {
      await writeKey("licenseKey", key);
      useLicense.setState({ status: "valid", key, expiresAt: data.expires_at ?? null });
    }
    return { ok: data.ok, error: data.error };
  } catch {
    return { ok: false, error: "Impossible de joindre le serveur de licence" };
  }
}

/** Heartbeat every 2 min; first tick at 2 min (hydrateLicense handles the initial verify). */
export function startHeartbeat(): ReturnType<typeof setInterval> {
  return setInterval(async () => {
    const { key } = useLicense.getState();
    if (!key || !isTauri()) return;
    try {
      const hwid = await getHwid();
      await callVerify(key, hwid);
    } catch { /* network errors don't revoke */ }
  }, 2 * 60 * 1000);
}
