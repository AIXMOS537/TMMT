import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { commandHubSections } from "@/lib/command-hub-nav";
import { OWNER_HUB_HOST } from "@/lib/site-domains";
import { ChevronRight } from "lucide-react";

export const metadata = {
  title: "Owner command hub — TMMT",
  description: "Private ops navigation for fleet, leads, bookings, and command messaging",
};

export default function CommandHubPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Owner command hub"
        description={`Private ops on ${OWNER_HUB_HOST} — fleet, pipeline, workflow, and executive command`}
      />

      <Card className="p-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <p className="text-sm text-gray-700 dark:text-slate-300">
          Public marketing and customer forms stay on{" "}
          <span className="font-medium">allinonemanagementsolutions.com</span>. This hub is
          owner-only on <span className="font-medium">{OWNER_HUB_HOST}</span>.
        </p>
      </Card>

      {commandHubSections.map((section) => (
        <section key={section.title}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-3">
            {section.title}
          </h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {section.links.map((item) => {
              const inner = (
                  <Card className="p-4 h-full transition-shadow hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700">
                    <div className="flex items-start justify-between gap-2">
                      <item.icon
                        size={22}
                        className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
                        aria-hidden
                      />
                      <ChevronRight
                        size={18}
                        className="text-gray-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors shrink-0"
                        aria-hidden
                      />
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white mt-2 flex items-center gap-2">
                      {item.label}
                      {item.badge && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                          {item.badge}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{item.description}</p>
                  </Card>
              );
              return (
                <li key={item.href}>
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block h-full group"
                    >
                      {inner}
                    </a>
                  ) : (
                    <Link href={item.href} className="block h-full group">
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
