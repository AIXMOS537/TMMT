import { cn } from "@aixmos/core";

const styles = {
  strong: "bg-emerald-100 text-emerald-800",
  moderate: "bg-amber-100 text-amber-900",
  weak: "bg-rose-100 text-rose-800",
  default: "bg-slate-100 text-slate-700",
  info: "bg-teal-100 text-teal-800",
};

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof styles;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
