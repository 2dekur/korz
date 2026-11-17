import * as RadixSlider from "@radix-ui/react-slider";
import { cn } from "@/lib/cn";

interface SliderProps {
  value: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  label: string;
  className?: string;
  disabled?: boolean;
}

/** Thin track that thickens slightly on hover; thumb only appears on hover/drag/focus. */
export function Slider({ value, max, step = 0.01, onChange, onCommit, label, className, disabled }: SliderProps) {
  return (
    <RadixSlider.Root
      className={cn("group relative flex h-4 w-full touch-none select-none items-center", disabled && "opacity-40", className)}
      value={[Math.min(value, max)]}
      max={max || 1}
      step={step}
      disabled={disabled}
      onValueChange={([v]) => v !== undefined && onChange(v)}
      onValueCommit={([v]) => v !== undefined && onCommit?.(v)}
      aria-label={label}
    >
      <RadixSlider.Track className="relative h-[3px] grow overflow-hidden rounded-full bg-white/[0.12] transition-[height] duration-150 group-hover:h-[4px]">
        <RadixSlider.Range className="absolute h-full rounded-full bg-fg/90 group-hover:bg-accent" />
      </RadixSlider.Track>
      <RadixSlider.Thumb className="block size-3 scale-0 rounded-full bg-fg shadow-[0_2px_8px_rgb(0_0_0/0.5)] transition-transform duration-150 group-hover:scale-100 focus-visible:scale-100 focus-visible:outline-none data-[disabled]:hidden" />
    </RadixSlider.Root>
  );
}
