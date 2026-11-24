import { create } from "zustand";
import { toast } from "sonner";
import { api, errorMessage } from "@/services/api";
import type { UpdateInfo } from "@/types";

type Status = "idle" | "checking" | "none" | "available" | "installing" | "error";

interface UpdatesState {
  status: Status;
  update: UpdateInfo | null;
  error: string | null;
}

export const useUpdates = create<UpdatesState>(() => ({ status: "idle", update: null, error: null }));

/** `silent`: launch check — no toast when up to date or offline, only when a version is available. */
export async function checkForUpdate(silent = false) {
  useUpdates.setState({ status: "checking", error: null });
  try {
    const update = await api.updateCheck();
    useUpdates.setState({ status: update ? "available" : "none", update });
    if (update && silent)
      toast(`KORZ Music ${update.version} est disponible`, {
        description: "Installation en un clic, l'application redémarre ensuite.",
        duration: Infinity,
        action: { label: "Installer", onClick: () => void installUpdate() },
      });
  } catch (err) {
    useUpdates.setState({ status: "error", error: errorMessage(err) });
  }
}

export async function installUpdate() {
  useUpdates.setState({ status: "installing", error: null });
  const id = toast.loading("Téléchargement de la mise à jour…");
  try {
    // On success the installer takes over and this window closes.
    await api.updateInstall();
  } catch (err) {
    toast.error("Mise à jour impossible", { id, description: errorMessage(err) });
    useUpdates.setState({ status: "error", error: errorMessage(err) });
  }
}
