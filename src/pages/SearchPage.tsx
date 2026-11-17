import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { search } from "@/services/catalog";
import { useDebounce } from "@/hooks/useDebounce";
import { useNavigation } from "@/store/navigation";
import { Artwork } from "@/components/ui/Artwork";
import { TrackList } from "@/components/track/TrackList";

// Survives page switches so coming back to Search keeps the query, like a native app.
let lastQuery = "";

export function SearchPage() {
  const [query, setQuery] = useState(lastQuery);
  const debounced = useDebounce(query, 200);
  const results = useMemo(() => search(debounced), [debounced]);
  const navigate = useNavigation((s) => s.navigate);
  lastQuery = query;

  return (
    <div className="px-8 pb-12 pt-20">
      <label className="relative flex h-12 max-w-[520px] items-center rounded-full bg-white/[0.06] ring-1 ring-line transition focus-within:bg-white/[0.08] focus-within:ring-white/20">
        <Search className="ml-4 size-[18px] text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Titres, artistes, albums"
          aria-label="Rechercher"
          className="h-full flex-1 bg-transparent px-3 text-[14px] text-fg placeholder:text-faint focus-visible:outline-none"
        />
        {query && (
          <button type="button" aria-label="Effacer" onClick={() => setQuery("")} className="mr-3 text-muted hover:text-fg">
            <X className="size-4" />
          </button>
        )}
      </label>

      {!debounced.trim() ? (
        <p className="mt-16 text-[14px] text-faint">Tapez pour chercher dans votre catalogue local.</p>
      ) : results.tracks.length === 0 && results.artists.length === 0 ? (
        <p className="mt-16 text-[14px] text-muted">
          Aucun résultat pour « <span className="text-fg">{debounced}</span> ».
        </p>
      ) : (
        <>
          {results.artists.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 font-display text-[20px] font-bold tracking-[-0.02em]">Artistes</h2>
              <div className="flex flex-wrap gap-2">
                {results.artists.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => navigate({ name: "artist", id: a.id })}
                    className="flex items-center gap-3 rounded-full bg-white/[0.05] py-1.5 pl-1.5 pr-5 text-[14px] font-medium transition-colors hover:bg-white/[0.09]"
                  >
                    <Artwork hue={a.hue} round className="size-9 shadow-none" />
                    {a.name}
                  </button>
                ))}
              </div>
            </section>
          )}
          {results.tracks.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 font-display text-[20px] font-bold tracking-[-0.02em]">Titres</h2>
              <TrackList tracks={results.tracks} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
