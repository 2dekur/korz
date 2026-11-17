import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigation } from "@/store/navigation";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";

export function TopBar() {
  const canBack = useNavigation((s) => s.cursor > 0);
  const canForward = useNavigation((s) => s.cursor < s.history.length - 1);
  const { back, forward } = useNavigation.getState();
  return (
    <div className="pointer-events-none sticky top-0 z-20 flex h-16 items-center gap-2 px-8">
      <div className="pointer-events-auto flex gap-2">
        <Tooltip label="Retour" side="bottom">
          <IconButton label="Retour" onClick={back} disabled={!canBack} className="bg-black/40 backdrop-blur-md">
            <ChevronLeft className="size-[18px]" />
          </IconButton>
        </Tooltip>
        <Tooltip label="Suivant" side="bottom">
          <IconButton label="Page suivante" onClick={forward} disabled={!canForward} className="bg-black/40 backdrop-blur-md">
            <ChevronRight className="size-[18px]" />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
}
