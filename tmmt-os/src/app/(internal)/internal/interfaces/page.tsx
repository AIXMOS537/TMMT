import Link from "next/link";
import { CalendarRange, Car, DollarSign, FileText, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RENTALS_INTERFACES, rentalsInterfaceHref } from "@/lib/rentals-portal";
import { cn } from "@/lib/utils";

const ICONS = {
  calendar: CalendarRange,
  file: FileText,
  car: Car,
  dollar: DollarSign,
} as const;

export default function InterfacesHubPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Airtable interfaces"
        description="Your four TMMT Rentals interfaces — appointments, contracts, vehicles, and payments — with dashboard, table, and calendar or Kanban views. Open in the rentals admin (same layouts you used in Airtable)."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {RENTALS_INTERFACES.map((iface) => {
          const Icon = ICONS[iface.icon as keyof typeof ICONS];
          const href = rentalsInterfaceHref(iface.slug);
          return (
            <Link
              key={iface.slug}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group surface-card flex flex-col bg-gradient-to-br p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
                iface.accent
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-xl bg-white/80 p-2.5 text-primary shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">{iface.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{iface.description}</p>
              <span className="mt-4 text-sm font-medium text-primary">Open interface →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
