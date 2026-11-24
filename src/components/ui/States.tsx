import { AlertCircle, Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-[13px] text-muted" role="status">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 py-6 text-[13px]" role="alert">
      <AlertCircle className="mt-px size-4 shrink-0 text-red-400" />
      <span className="text-muted">{message}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <Icon className="size-9 text-faint" strokeWidth={1.5} />
      <h2 className="mt-4 font-display text-[18px] font-bold">{title}</h2>
      <div className="mt-1.5 max-w-[420px] text-[13px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}
