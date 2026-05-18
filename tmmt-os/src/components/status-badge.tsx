import { cn } from "@/lib/utils";
import { toneStyles, type StatusTone } from "@/lib/ui/status-colors";

export function StatusBadge({
  label,
  tone,
  dot = true,
  className,
}: {
  label: string;
  tone: StatusTone;
  dot?: boolean;
  className?: string;
}) {
  const s = toneStyles(tone);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        s.badge,
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.dot)} aria-hidden />}
      {label}
    </span>
  );
}
