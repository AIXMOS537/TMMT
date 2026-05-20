import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { PARTNER_APPS } from "@/lib/verticals/partner-apps";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700",
  recruiting: "bg-amber-500/15 text-amber-800",
  planned: "bg-muted text-muted-foreground",
};

export default async function PartnerVerticalsPage() {
  await requireRole(["admin", "internal_team"]);

  const waves = [1, 2, 3] as const;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Partner verticals"
        description="30-app roadmap — Wave 1 rentals live; Property (#02) and Service Arbitrage (#03) recruiting."
        action={
          <Link
            href="/internal/marketplace"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            Marketplace admin
          </Link>
        }
      />

      {waves.map((wave) => {
        const apps = PARTNER_APPS.filter((a) => a.wave === wave);
        return (
          <section key={wave} className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Wave {wave}
            </h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">#</th>
                    <th className="p-3 font-medium">App</th>
                    <th className="p-3 font-medium">Industry</th>
                    <th className="p-3 font-medium">Team</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Slug</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {apps.map((app) => (
                    <tr key={app.slug} className="hover:bg-muted/30">
                      <td className="p-3 tabular-nums">{app.number}</td>
                      <td className="p-3 font-medium">{app.name}</td>
                      <td className="p-3 text-muted-foreground">{app.industry}</td>
                      <td className="p-3">{app.teamSize}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[app.status]}`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs">{app.slug}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section className="surface-card space-y-2 p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Deploying #02 Property or #03 Service Arbitrage</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Provision org license SKU: <code>property_arbitrage</code> or <code>service_arbitrage</code></li>
          <li>Clone base layer — Dashboard, Learn, Marketplace, Operate</li>
          <li>Add marketplace listings under the vertical slug in Marketplace admin</li>
          <li>Partner team brief: 5 required roles (Lead, Dev, Content, Sales, VA)</li>
        </ul>
      </section>
    </div>
  );
}
