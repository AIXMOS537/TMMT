import * as React from "react";
import { cn } from "@/lib/utils";

/** Ported from TMMT OS for the public front door. */
export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...props }, ref) {
    return (
      <label
        ref={ref}
        className={cn("text-sm font-medium leading-none text-foreground", className)}
        {...props}
      />
    );
  }
);
