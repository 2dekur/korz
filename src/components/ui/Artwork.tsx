import { cn } from "@/lib/cn";

/** Generated artwork: layered gradients from a hue, so covers render instantly with no network. */
export function Artwork({ hue, className, round, label }: { hue: number; className?: string; round?: boolean; label?: string }) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden shadow-[0_4px_16px_rgb(0_0_0/0.35)]",
        round ? "rounded-full" : "rounded-[6px]",
        label && "[container-type:inline-size]",
        className,
      )}
      style={{
        background: `radial-gradient(120% 90% at 18% 12%, hsl(${hue} 85% 68% / 0.95), transparent 55%),
          radial-gradient(90% 90% at 90% 100%, hsl(${(hue + 50) % 360} 70% 40%), transparent 60%),
          linear-gradient(150deg, hsl(${hue} 55% 34%), hsl(${(hue + 30) % 360} 45% 12%))`,
      }}
      aria-hidden={!label}
    >
      {label && (
        <span className="absolute inset-0 flex items-center justify-center font-display text-[36cqw] font-bold text-white/90">
          {label}
        </span>
      )}
    </div>
  );
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
