import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { useNavigation } from "@/store/navigation";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { SearchBox } from "@/components/search/SearchBox";
import { useScrollContainer } from "./ScrollContext";

export function TopBar() {
  const canBack = useNavigation((s) => s.cursor > 0);
  const canForward = useNavigation((s) => s.cursor < s.history.length - 1);
  const { back, forward } = useNavigation.getState();
  const scrollRef = useScrollContainer();
  const [scrolled, setScrolled] = useState(false);

  // Transparent over page headers, frosted once content scrolls underneath.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 8);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex h-16 items-center gap-4 px-8 transition-[background-color,box-shadow] duration-200",
        scrolled && "bg-bg/75 shadow-[0_1px_0_var(--color-line)] backdrop-blur-xl",
      )}
    >
      <div className="flex gap-2">
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
      <SearchBox />
    </div>
  );
}
