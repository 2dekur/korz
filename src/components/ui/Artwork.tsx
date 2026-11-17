import { cn } from "@/lib/cn";
import { hueFromSeed } from "@/lib/music";

interface ArtworkProps {
  src?: string;
  /** Picks the placeholder gradient when there is no image (or while it loads). */
  seed?: string;
  hue?: number;
  className?: string;
  round?: boolean;
  label?: string;
}

/** Cover/photo with a generated gradient underneath: no layout shift and no blank box while loading. */
export function Artwork({ src, seed = "", hue, className, round, label }: ArtworkProps) {
  const h = hue ?? hueFromSeed(seed);
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden shadow-[0_4px_16px_rgb(0_0_0/0.35)]",
        round ? "rounded-full" : "rounded-[6px]",
        label && "[container-type:inline-size]",
        className,
      )}
      style={{
        background: `radial-gradient(120% 90% at 18% 12%, hsl(${h} 70% 60% / 0.9), transparent 55%),
          linear-gradient(150deg, hsl(${h} 45% 30%), hsl(${(h + 30) % 360} 40% 12%))`,
      }}
    >
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300"
          onLoad={(e) => e.currentTarget.classList.remove("opacity-0")}
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
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
