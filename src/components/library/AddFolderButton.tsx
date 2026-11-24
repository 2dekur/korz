import { open } from "@tauri-apps/plugin-dialog";
import { FolderPlus } from "lucide-react";
import { api } from "@/services/api";
import { runScan, useLibrary } from "@/store/library";
import { Button } from "@/components/ui/Button";

export async function pickAndAddFolder() {
  const path = await open({ directory: true, multiple: false, title: "Choisir un dossier de musique" });
  if (typeof path === "string") await runScan(() => api.addFolder(path));
}

export function AddFolderButton({ variant = "primary" }: { variant?: "primary" | "ghost" }) {
  const scanning = useLibrary((s) => s.scanning !== null);
  return (
    <Button variant={variant} onClick={() => void pickAndAddFolder()} disabled={scanning}>
      <FolderPlus className="size-4" /> Ajouter un dossier
    </Button>
  );
}
