import Link from "next/link";
import { CalendarRange, Car, DollarSign, FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RENTALS_INTERFACES, rentalsInterfaceHref } from "@/lib/rentals-portal";
import { cn } from "@/lib/utils";

const ICONS = {
  calendar: CalendarRange,
  file: FileText,
  car: Car,
  dollar: DollarSign,
} as const;

export default function ManagementHubPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="TMMT Rentals"
        description="Appointments, contracts, vehicles, and payments — now inside TMMT OS at /v/tmmt-rentals."
        action={
          <Link href="/v/tmmt-rentals" className="text-sm font-medium text-primary hover:underline">
            Open full rentals admin →
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {RENTALS_INTERFACES.map((iface) => {
          const Icon = ICONS[iface.icon as keyof typeof ICONS];
          const href = rentalsInterfaceHref(iface.slug);
          return (
            <Link
              key={iface.slug}
              href={href}
              className={cn(
                "group surface-card flex flex-col bg-gradient-to-br p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
                iface.accent
              )}
            >
              <div className="rounded-xl bg-white/80 p-2.5 text-primary shadow-sm dark:bg-slate-900/50">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">{iface.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{iface.description}</p>
              <span className="mt-4 text-sm font-medium text-primary">Open workspace →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
