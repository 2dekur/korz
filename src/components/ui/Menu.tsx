import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * Popover menu rendered in a portal (rows are virtualized and clipped). Closes on outside click,
 * Escape, scroll or resize; keyboard users reach items with Tab.
 */
export function Menu({ trigger, children, label }: { trigger: (open: () => void, active: boolean) => ReactNode; children: (close: () => void) => ReactNode; label: string }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const close = () => setPos(null);

  const open = () => {
    const r = anchor.current?.getBoundingClientRect();
    if (r) setPos({ x: r.right, y: r.bottom + 4 });
  };

  useLayoutEffect(() => {
    const el = panel.current;
    if (!pos || !el) return;
    const { width, height } = el.getBoundingClientRect();
    const x = Math.max(8, Math.min(pos.x - width, window.innerWidth - width - 8));
    const y = pos.y + height > window.innerHeight - 8 ? Math.max(8, pos.y - height - 40) : pos.y;
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.querySelector<HTMLElement>("button")?.focus();
  }, [pos]);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: PointerEvent) => !panel.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("wheel", close, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("wheel", close);
    };
  }, [pos]);

  return (
    <>
      <span ref={anchor} className="inline-flex">
        {trigger(open, !!pos)}
      </span>
      {pos &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            aria-label={label}
            className="fixed left-0 top-0 z-50 min-w-[220px] max-w-[300px] rounded-lg bg-raised p-1 shadow-[0_16px_40px_rgb(0_0_0/0.55)] ring-1 ring-white/10 animate-[fade-in_100ms_ease-out]"
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({ onSelect, children, className, disabled }: { onSelect: () => void; children: ReactNode; className?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] text-fg outline-none hover:bg-white/[0.07] focus-visible:bg-white/[0.07] disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{children}</div>;
}
