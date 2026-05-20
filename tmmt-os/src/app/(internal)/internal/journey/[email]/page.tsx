import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getJourneyByEmailForStaff } from "@/lib/client-journey/queries";
import { PageHeader } from "@/components/page-header";
import { JourneyGates } from "@/components/client-journey/journey-gates";
import { StaffJourneyActions } from "@/components/client-journey/staff-journey-actions";
import { StaffLtoActions } from "@/components/client-journey/staff-lto-actions";
import { OperatorRubricForm } from "@/components/client-journey/operator-rubric-form";
import { JourneyCommandCenterBridge } from "@/components/client-journey/journey-command-center-bridge";
import { pathLabel } from "@/lib/client-journey/credit-paths";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InternalJourneyDetailPage({
  params,
}: {
  params: { email: string };
}) {
  await requireRole(["admin", "internal_team"]);
  const email = decodeURIComponent(params.email).trim().toLowerCase();
  if (!email.includes("@")) notFound();

  const hub = await getJourneyByEmailForStaff(email);
  if (!hub.journey) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={email}
        description={`Track ${hub.journey.program_track} · ${hub.journey.good_standing_days} days good standing`}
        action={
          <Link href="/internal/journey" className="text-sm font-medium text-primary hover:underline">
            ← All journeys
          </Link>
        }
      />

      <StaffJourneyActions email={email} />

      <StaffLtoActions email={email} ltoEligible={hub.lto.eligible} />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">LTO gates</h2>
        <JourneyGates hub={hub} />
        {hub.lto.eligible && (
          <p className="text-sm text-emerald-600 font-medium">Client is LTO eligible.</p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Credit plans</h2>
          <ul className="space-y-2 text-sm">
            {hub.creditPlans.map((p) => (
              <li key={p.id} className="surface-card p-3">
                {pathLabel(p.credit_path)} — {p.status}
              </li>
            ))}
            {hub.creditPlans.length === 0 && (
              <p className="text-muted-foreground">No credit path assigned.</p>
            )}
          </ul>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Training</h2>
          <p className="text-sm text-muted-foreground">
            Core modules: {hub.training.coreDone}/{hub.training.coreTotal}
            {hub.training.coreComplete ? " (complete)" : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Education: {hub.education.allAcknowledged ? "complete" : "incomplete"}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Checkpoints</h2>
        <ul className="space-y-1 text-sm">
          {hub.checkpoints.map((c) => (
            <li key={c.slug} className="flex justify-between">
              <span>{c.title}</span>
              <span>{c.met_at ? formatDate(c.met_at) : "—"}</span>
            </li>
          ))}
        </ul>
      </section>

      <JourneyCommandCenterBridge email={email} />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Operator rubric</h2>
        {hub.operator.profile && (
          <p className="text-sm text-muted-foreground">
            Level {hub.operator.profile.level} · Score {hub.operator.profile.rubric_score} · TMMT share{" "}
            {hub.operator.profile.revenue_share_pct}%
          </p>
        )}
        <OperatorRubricForm defaultEmail={email} />
      </section>
    </div>
  );
}

