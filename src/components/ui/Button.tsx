import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "ghost", className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        variant === "primary" && "bg-fg text-bg hover:bg-white",
        variant === "ghost" && "text-fg ring-1 ring-white/15 hover:ring-white/35",
        variant === "danger" && "text-red-300 ring-1 ring-red-400/30 hover:bg-red-400/10",
        className,
      )}
      {...props}
    />
  );
});

/** The one accent-coloured control: starts playback of a collection. */
export function PlayButton({ label, onClick, disabled, className }: { label: string; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-12 items-center justify-center rounded-full bg-accent text-bg shadow-[0_8px_24px_rgb(0_0_0/0.35)] transition-transform duration-150 hover:scale-[1.04] active:scale-95 disabled:opacity-30",
        className,
      )}
    >
      <Play className="ml-0.5 size-5 fill-current" />
    </button>
  );
}
