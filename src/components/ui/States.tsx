import { Loader2, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-[13px] text-muted" role="status">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorState({ message, onRetry, children }: { message: string; onRetry?: () => void; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-8" role="alert">
      <div className="flex items-center gap-2 text-[14px] font-medium text-fg">
        <WifiOff className="size-4 text-muted" /> Catalogue injoignable
      </div>
      <p className="max-w-[460px] text-[13px] text-muted">{message}</p>
      {children}
      {onRetry && (
        <button type="button" onClick={onRetry} className="h-8 rounded-full px-4 text-[13px] font-semibold ring-1 ring-white/20 transition hover:ring-white/50">
          Réessayer
        </button>
      )}
    </div>
  );
}

/** Grey blocks shown while remote rows load, sized like the real content to avoid layout jumps. */
export function RowSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="mt-2 flex flex-col gap-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-12 items-center gap-3 px-4">
          <div className="size-10 animate-pulse rounded-[4px] bg-white/[0.06]" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-48 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-2.5 w-28 animate-pulse rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}
