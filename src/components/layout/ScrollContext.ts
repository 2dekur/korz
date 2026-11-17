import { createContext, useContext, type RefObject } from "react";

/** The main view's scroll container, shared so virtualized lists can scroll with the page. */
export const ScrollContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function useScrollContainer() {
  const ref = useContext(ScrollContext);
  if (!ref) throw new Error("useScrollContainer must be used inside <AppShell>");
  return ref;
}
