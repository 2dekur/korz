import { create } from "zustand";
import { toast } from "sonner";
import { api, errorMessage } from "@/services/api";
import type { LinkCandidate, LinkResolution } from "@/types";
import { useLibrary } from "./library";

export type LinkAction = "play" | "enqueue" | "import";

interface SmartLinkState {
  /** Resolution shown in the confirmation card; null when closed. */
  current: LinkResolution | null;
  selected: number;
  busy: LinkAction | null;
}

export const useSmartLink = create<SmartLinkState>(() => ({ current: null, selected: 0, busy: null }));

export const isLink = (text: string) => /^(https?:\/\/\S+|spotify:\S+)$/i.test(text.trim());

const label = (r: LinkResolution, c: LinkCandidate | undefined) => c?.track?.title ?? r.meta.title ?? "Lien";

/** Recognises a pasted link, then plays at once or opens the card, as decided by the backend setting. */
export async function openLink(url: string) {
  const id = toast.loading("Analyse du lien…");
  try {
    const r = await api.linkResolve(url.trim());
    toast.dismiss(id);
    if (r.decision === "play") await act(r, 0, "play");
    else useSmartLink.setState({ current: r, selected: 0, busy: null });
  } catch (err) {
    toast.error("Lien illisible", { id, description: errorMessage(err) });
  }
}

export const closeLink = () => useSmartLink.setState({ current: null, busy: null });

export async function act(r: LinkResolution, index: number, action: LinkAction) {
  const c = r.candidates[index];
  useSmartLink.setState({ busy: action });
  const id = action === "play" && c?.kind === "local" ? undefined : toast.loading(action === "import" ? "Import en cours…" : "Téléchargement du fichier…");
  try {
    if (action === "import") {
      const res = await api.linkImport(r.url);
      useLibrary.getState().bump();
      toast.success(res.duplicate ? "Déjà dans votre bibliothèque" : "Importé dans la bibliothèque", { id, description: res.track.title });
    } else if (c?.kind === "local" && c.track) {
      await (action === "play" ? api.play([c.track.id], 0) : api.enqueue([c.track.id]));
      toast.success(action === "play" ? `Lecture : ${label(r, c)}` : `Ajouté à la file : ${label(r, c)}`, { id });
    } else if (c?.kind === "direct") {
      await api.linkPlay(r.url, action === "enqueue");
      toast.success(action === "play" ? `Lecture : ${label(r, c)}` : `Ajouté à la file : ${label(r, c)}`, { id });
    }
    closeLink();
  } catch (err) {
    toast.error("Action impossible", { id, description: errorMessage(err) });
    useSmartLink.setState({ busy: null });
  }
}
