import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean };

/** Borderless icon button. `label` is required: icon-only controls need an accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:text-fg disabled:pointer-events-none disabled:opacity-30",
        active && "text-accent hover:text-accent",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
