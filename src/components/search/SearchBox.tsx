import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Loader2, Search, X } from "lucide-react";
import type { Artist, SearchResults, Track } from "@/types";
import { cn } from "@/lib/cn";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearch } from "@/store/search";
import { retry, searchKey, useSearchResults, prefetchArtist } from "@/store/catalog";
import { useNavigation, useRoute } from "@/store/navigation";
import { usePlayer } from "@/store/player";
import { Artwork } from "@/components/ui/Artwork";
import { VerifiedBadge } from "@/components/ui/Badges";
import { FollowButton } from "@/components/track/FollowButton";
import { CompactTrackRow } from "@/components/track/CompactTrackRow";

type Item =
  | { kind: "query"; text: string }
  | { kind: "artist"; artist: Artist }
  | { kind: "track"; track: Track; index: number }
  | { kind: "all" };

const DROPDOWN_TRACKS = 5;

/** Top-bar search with a Spotify-style floating panel. Arrow keys move through every row; Enter selects. */
export function SearchBox() {
  const { query, setQuery, focusTick } = useSearch();
  const route = useRoute();
  const navigate = useNavigation((s) => s.navigate);
  const playQueue = usePlayer((s) => s.playQueue);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const debounced = useDebounce(query, 200);
  const entry = useSearchResults(debounced);
  // Stale-while-revalidate: keep the previous results on screen while the next query loads.
  const last = useRef<SearchResults | undefined>(undefined);
  if (entry?.status === "ready") last.current = entry.data;
  const hasQuery = searchKey(query) !== "";
  const results = entry?.status === "ready" ? entry.data : hasQuery ? last.current : undefined;
  const loading = hasQuery && (entry?.status !== "ready" || debounced !== query);

  useEffect(() => {
    if (focusTick) inputRef.current?.focus();
  }, [focusTick]);
  useEffect(() => setActive(-1), [debounced]);

  const items = useMemo<Item[]>(() => {
    if (!results) return [];
    return [
      ...results.suggestions.map((text) => ({ kind: "query" as const, text })),
      ...(results.topArtist ? [{ kind: "artist" as const, artist: results.topArtist }] : []),
      ...results.tracks.slice(0, DROPDOWN_TRACKS).map((track, index) => ({ kind: "track" as const, track, index })),
      { kind: "all" as const },
    ];
  }, [results]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const showAll = (q: string) => {
    setQuery(q);
    navigate({ name: "search" });
    close();
  };

  const select = (item: Item) => {
    switch (item.kind) {
      case "query":
        return showAll(item.text);
      case "all":
        return showAll(query);
      case "artist":
        navigate({ name: "artist", id: item.artist.id });
        close();
        return inputRef.current?.blur();
      case "track":
        playQueue(results!.tracks, item.index);
        return close();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = items.length;
    if (e.key === "ArrowDown" && n) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % n);
    } else if (e.key === "ArrowUp" && n) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? n - 1 : i - 1));
    } else if (e.key === "Enter") {
      const item = items[active];
      if (item) select(item);
      else if (hasQuery) showAll(query);
    } else if (e.key === "Escape") {
      if (open) close();
      else inputRef.current?.blur();
    }
  };

  const activeItem = items[active];
  useEffect(() => {
    if (activeItem?.kind === "artist") prefetchArtist(activeItem.artist.id);
  }, [activeItem]);

  const showPanel = open && hasQuery && route.name !== "search";
  const optionProps = (i: number) => ({
    id: `search-opt-${i}`,
    role: "option",
    "aria-selected": active === i,
    tabIndex: -1,
    onMouseMove: () => active !== i && setActive(i),
    onClick: () => select(items[i]!),
  });
  const indexOf = (pred: (it: Item) => boolean) => items.findIndex(pred);

  return (
    <div
      className="relative w-[min(440px,42vw)]"
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && close()}
    >
      <label className="flex h-11 items-center rounded-full bg-raised/90 ring-1 ring-line backdrop-blur-xl transition focus-within:bg-raised focus-within:ring-white/25 hover:ring-white/15">
        <Search className="ml-4 size-[18px] shrink-0 text-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Que souhaitez-vous écouter ?"
          role="combobox"
          aria-label="Rechercher"
          aria-expanded={showPanel}
          aria-controls="search-listbox"
          aria-activedescendant={active >= 0 ? `search-opt-${active}` : undefined}
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[14px] text-fg placeholder:text-faint focus-visible:outline-none"
        />
        {loading && <Loader2 className="mr-2 size-4 shrink-0 animate-spin text-faint" />}
        {query && (
          <button
            type="button"
            aria-label="Effacer"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="mr-3 text-muted hover:text-fg"
          >
            <X className="size-4" />
          </button>
        )}
      </label>

      {showPanel && (
        <motion.div
          id="search-listbox"
          role="listbox"
          aria-label="Suggestions de recherche"
          initial={{ opacity: 0, y: -4, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className="absolute left-0 top-full z-30 mt-2 max-h-[min(640px,75vh)] w-[min(580px,60vw)] overflow-y-auto rounded-xl bg-raised/95 p-2 shadow-[0_24px_64px_rgb(0_0_0/0.6)] ring-1 ring-line backdrop-blur-2xl"
        >
          {!results && entry?.status === "error" ? (
            <div className="flex items-center justify-between gap-4 px-3 py-4 text-[13px] text-muted">
              Catalogue injoignable.
              <button type="button" onClick={() => retry("searches", searchKey(debounced))} className="font-semibold text-fg hover:underline">
                Réessayer
              </button>
            </div>
          ) : !results ? (
            <div className="flex items-center gap-2 px-3 py-4 text-[13px] text-muted">
              <Loader2 className="size-4 animate-spin" /> Recherche…
            </div>
          ) : (
            <>
              {results.suggestions.map((text) => {
                const i = indexOf((it) => it.kind === "query" && it.text === text);
                return (
                  <div key={text} {...optionProps(i)} className={cn("flex h-10 items-center gap-3 rounded-md px-3 text-[14px]", active === i && "bg-white/[0.08]")}>
                    <Search className="size-4 text-faint" />
                    <span className="truncate">{text}</span>
                  </div>
                );
              })}

              {results.topArtist && (
                <>
                  <SectionLabel>Meilleur résultat</SectionLabel>
                  {(() => {
                    const a = results.topArtist;
                    const i = indexOf((it) => it.kind === "artist");
                    return (
                      <div
                        {...optionProps(i)}
                        onPointerEnter={() => prefetchArtist(a.id)}
                        className={cn("flex items-center gap-4 rounded-lg p-2 transition-colors", active === i ? "bg-white/[0.08]" : "hover:bg-white/[0.05]")}
                      >
                        <Artwork src={a.picture} seed={a.id} round className="size-14" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[15px] font-semibold">{a.name}</span>
                            <VerifiedBadge fans={a.fans} />
                          </div>
                          <div className="text-[13px] text-muted">Artiste</div>
                        </div>
                        <FollowButton artist={a} />
                      </div>
                    );
                  })()}
                </>
              )}

              {results.tracks.length > 0 && <SectionLabel>Titres</SectionLabel>}
              {results.tracks.slice(0, DROPDOWN_TRACKS).map((track) => {
                const i = indexOf((it) => it.kind === "track" && it.track.id === track.id);
                return <CompactTrackRow key={track.id} track={track} active={active === i} {...optionProps(i)} />;
              })}

              {results.tracks.length === 0 && !results.topArtist && (
                <div className="px-3 py-4 text-[13px] text-muted">Aucun résultat pour « {query} ».</div>
              )}

              {(() => {
                const i = items.length - 1;
                return (
                  <div
                    {...optionProps(i)}
                    className={cn("mt-1 flex h-10 items-center justify-between rounded-md border-t border-line px-3 text-[13px] font-medium text-muted", active === i && "bg-white/[0.08] text-fg")}
                  >
                    Afficher tous les résultats pour « {query.trim()} »
                    <ArrowUpRight className="size-4" />
                  </div>
                );
              })()}
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <div className="px-3 pb-1.5 pt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{children}</div>;
}
