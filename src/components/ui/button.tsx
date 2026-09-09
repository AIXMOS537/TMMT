import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Ported from TMMT OS for the public front door.
 *
 * Rewritten without class-variance-authority: cva is a dependency there and
 * not here, and the front door is not worth adding one for. Plain lookup maps
 * behave identically for this many variants.
 */
const VARIANTS = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border border-border bg-transparent hover:bg-muted",
  ghost: "bg-transparent hover:bg-muted",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-sm",
  default: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-base",
} as const;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant = "default", size = "default", ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          VARIANTS[variant],
          SIZES[size],
          className
        )}
        {...props}
      />
    );
  }
);
