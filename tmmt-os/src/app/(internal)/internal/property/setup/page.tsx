import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getOrganizationVertical } from "@/lib/verticals/resolve";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "A — Access your app",
    body: "Log into TMMT OS. Dashboard, Learn, Marketplace, and Operate modules are ready to brand.",
  },
  {
    title: "B — Brand your vertical",
    body: "Set organization partner_app_slug to tmmt_property and vertical to property. White-label name: TMMT Property.",
  },
  {
    title: "C — Configure CRM",
    body: "GHL sub-account with STR pipeline: inquiry → qualified → booked → active host.",
  },
  {
    title: "D — Define your offer",
    body: "$97/mo entry, Foundation $397+, Systems $1,875+, Infrastructure $7,500.",
  },
  {
    title: "E — Marketplace listings",
    body: "Add 3+ deals/vendors at /internal/marketplace under vertical tmmt_property.",
  },
  {
    title: "F — Go live on content",
    body: "Proof → Education → Story → BTS rotation. IG + TikTok daily per marketing rollout.",
  },
  {
    title: "G — Hire VA / executives",
    body: "Use VA elevation framework: COO, Client Experience, Pipeline, Content, Data.",
  },
  {
    title: "H — Pull marketing KPIs",
    body: "Weekly GHL sync at /team/performance — subscribers, calls, form fills auto-fill.",
  },
];

export default async function PropertySetupPage() {
  await requireRole(["admin", "internal_team"]);
  const vertical = await getOrganizationVertical();
  if (vertical !== "property" && vertical !== "service_arbitrage") {
    redirect("/internal/dashboard");
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Property setup wizard"
        description="A–Z launch checklist from the 50-app sellable framework (property vertical)."
        action={
          <Link
            href="/internal/property"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Dashboard
          </Link>
        }
      />

      <ol className="space-y-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="surface-card flex gap-4 p-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {i + 1}
            </span>
            <div>
              <h2 className="font-medium">{step.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="surface-card border-dashed p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Enable this shell on your org</p>
        <p className="mt-2">
          In Supabase SQL Editor (or admin tooling):
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
{`update public.organizations
set vertical = 'property',
    partner_app_slug = 'tmmt_property'
where id = 'YOUR_ORG_UUID';`}
        </pre>
        <p className="mt-2">
          Then provision license SKU <code>property_arbitrage</code> and refresh the ops portal.
        </p>
      </section>
    </div>
  );
}
