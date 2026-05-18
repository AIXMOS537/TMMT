import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { toneStyles, type StatusTone } from "@/lib/ui/status-colors";

export function ColoredRow({
  href,
  tone,
  children,
  className,
}: {
  href?: string;
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  const s = toneStyles(tone);
  const classes = cn(
    "block rounded-xl border border-border/50 border-l-[3px] p-3.5 transition-all duration-200",
    s.border,
    s.row,
    href && "hover:shadow-soft hover:-translate-y-px",
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return <div className={classes}>{children}</div>;
}
