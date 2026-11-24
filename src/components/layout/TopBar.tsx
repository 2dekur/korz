import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useNavigation, useRoute } from "@/store/navigation";
import { useUi } from "@/store/ui";
import { IconButton } from "@/components/ui/IconButton";

export function TopBar() {
  const canBack = useNavigation((s) => s.cursor > 0);
  const canForward = useNavigation((s) => s.cursor < s.history.length - 1);
  const { back, forward, navigate } = useNavigation.getState();
  const search = useUi((s) => s.search);
  const setSearch = useUi((s) => s.setSearch);
  const route = useRoute();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (route.name === "search") input.current?.focus();
  }, [route.name]);

  // Ctrl+K / Ctrl+F: jump to search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "f")) {
        e.preventDefault();
        navigate({ name: "search" });
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-[color-mix(in_srgb,var(--color-bg)_72%,transparent)] px-6 backdrop-blur-md">
      <div className="flex gap-1">
        <IconButton label="Précédent" onClick={back} disabled={!canBack} className="bg-white/[0.04]">
          <ChevronLeft className="size-[18px]" />
        </IconButton>
        <IconButton label="Suivant" onClick={forward} disabled={!canForward} className="bg-white/[0.04]">
          <ChevronRight className="size-[18px]" />
        </IconButton>
      </div>
      <label className="relative flex w-full max-w-[380px] items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-faint" />
        <input
          ref={input}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (route.name !== "search") navigate({ name: "search" });
          }}
          onKeyDown={(e) => e.key === "Escape" && setSearch("")}
          placeholder="Rechercher dans la bibliothèque"
          aria-label="Rechercher dans la bibliothèque"
          spellCheck={false}
          className="h-9 w-full rounded-full bg-white/[0.06] pl-9 pr-9 text-[13px] text-fg outline-none ring-1 ring-transparent transition placeholder:text-faint focus:bg-white/[0.08] focus:ring-white/15"
        />
        {search && (
          <button type="button" aria-label="Effacer la recherche" onClick={() => setSearch("")} className="absolute right-3 text-faint hover:text-fg">
            <X className="size-4" />
          </button>
        )}
      </label>
    </div>
  );
}
