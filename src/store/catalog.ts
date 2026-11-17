import { useEffect } from "react";
import { create } from "zustand";
import type { ArtistPageData, HomeData, SearchResults } from "@/types";
import { getArtistPage, getHome, searchCatalog } from "@/services/musicApi";
import { normalize } from "@/lib/format";

export type Entry<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; error: string };

interface Buckets {
  searches: Record<string, Entry<SearchResults>>;
  artists: Record<string, Entry<ArtistPageData>>;
  home: Record<string, Entry<HomeData>>;
}

/** In-memory cache for every remote read: revisiting a query or artist is instant and costs no request. */
export const useCatalog = create<Buckets>(() => ({ searches: {}, artists: {}, home: {} }));

// Callers pair each bucket with its matching fetcher; the cast keeps this helper bucket-agnostic.
function ensure(bucket: keyof Buckets, key: string, fetcher: () => Promise<unknown>) {
  const current = useCatalog.getState()[bucket][key];
  if (current && current.status !== "error") return; // cached or in flight
  const put = (entry: Entry<unknown>) =>
    useCatalog.setState((s) => ({ [bucket]: { ...s[bucket], [key]: entry } }) as Partial<Buckets>);
  put({ status: "loading" });
  fetcher().then(
    (data) => put({ status: "ready", data }),
    (err: unknown) => put({ status: "error", error: err instanceof Error ? err.message : String(err) }),
  );
}

export const searchKey = (query: string) => normalize(query.trim()).replace(/\s+/g, " ");

export const prefetchArtist = (id: string) => ensure("artists", id, () => getArtistPage(id));

export function useSearchResults(query: string): Entry<SearchResults> | undefined {
  const key = searchKey(query);
  useEffect(() => {
    if (key) ensure("searches", key, () => searchCatalog(key));
  }, [key]);
  return useCatalog((s) => (key ? s.searches[key] : undefined));
}

export function useArtistPage(id: string) {
  useEffect(() => prefetchArtist(id), [id]);
  return useCatalog((s) => s.artists[id]);
}

export function useHome() {
  useEffect(() => ensure("home", "chart", () => getHome()), []);
  return useCatalog((s) => s.home.chart);
}

/** Retry after an error: drops the failed entry so the hook refetches. */
export function retry(bucket: keyof Buckets, key: string) {
  useCatalog.setState((s) => {
    const next = { ...s[bucket] };
    delete next[key];
    return { [bucket]: next } as Partial<Buckets>;
  });
}
