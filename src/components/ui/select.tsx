import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Ported from TMMT OS for the public front door.
 *
 * A native <select>, not the Radix listbox: the intake form is the only
 * consumer, it posts as a plain form, and a native control needs no client
 * JavaScript to work.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
