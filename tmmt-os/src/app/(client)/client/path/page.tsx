import Link from "next/link";
import { requireEntitlement } from "@/lib/auth-portals";
import { getCurrentUser } from "@/lib/auth";
import { getJourneyHub } from "@/lib/client-journey/queries";
import { PageHeader } from "@/components/page-header";
import { JourneyGates } from "@/components/client-journey/journey-gates";
import { pathLabel } from "@/lib/client-journey/credit-paths";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientPathPage() {
  await requireEntitlement("journey_path", "/client/dashboard");
  const me = await getCurrentUser();
  if (!me?.email) {
    return <p className="text-sm text-muted-foreground">Add an email to your profile to view your path.</p>;
  }

  const hub = await getJourneyHub(me.email, me.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="My path"
        description="Rental → credit repair → training → 90-day good standing → lease-to-own → operator."
      />

      <section className="surface-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Program track</p>
        <p className="mt-1 text-lg font-semibold capitalize">
          {(hub.journey?.program_track ?? "renter").replace(/_/g, " ")}
        </p>
        {hub.journey?.good_standing_since && (
          <p className="mt-1 text-sm text-muted-foreground">
            Good standing since {formatDate(hub.journey.good_standing_since)}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">LTO gates</h2>
        <JourneyGates hub={hub} />
      </section>

      {hub.creditPlans.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Credit plans</h2>
          <ul className="space-y-2">
            {hub.creditPlans.map((p) => (
              <li key={p.id} className="surface-card flex justify-between p-4 text-sm">
                <span>{pathLabel(p.credit_path)}</span>
                <span className="text-muted-foreground capitalize">{p.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Checkpoints</h2>
        <ul className="space-y-2">
          {hub.checkpoints.map((c) => (
            <li key={c.slug} className="flex justify-between text-sm">
              <span>{c.title}</span>
              <span className={c.met_at ? "text-emerald-600" : "text-muted-foreground"}>
                {c.met_at ? formatDate(c.met_at) : "Pending"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/client/credit" className="text-primary hover:underline">
          Credit education →
        </Link>
        <Link href="/client/training" className="text-primary hover:underline">
          Training →
        </Link>
        <Link href="/client/upgrade" className="text-primary hover:underline">
          Paths & mentorship →
        </Link>
      </div>
    </div>
  );
}
