import { useEffect, useState } from "react";
import { errorMessage } from "@/services/api";
import { useLibrary } from "@/store/library";

export type Query<T> =
  | { status: "loading"; data?: T }
  | { status: "ready"; data: T }
  | { status: "error"; error: string; data?: T };

/** Runs a backend read; re-runs when `deps` or the library revision change, keeping the last data meanwhile. */
export function useQuery<T>(load: () => Promise<T>, deps: unknown[]): Query<T> {
  const revision = useLibrary((s) => s.revision);
  const [state, setState] = useState<Query<T>>({ status: "loading" });
  useEffect(() => {
    let live = true;
    setState((s) => ({ status: "loading", data: s.data }));
    load().then(
      (data) => live && setState({ status: "ready", data }),
      (err) => live && setState((s) => ({ status: "error", error: errorMessage(err), data: s.data })),
    );
    return () => {
      live = false;
    };
    // `load` is recreated every render; `deps` carries what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision]);
  return state;
}
