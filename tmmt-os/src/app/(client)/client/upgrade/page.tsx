import Link from "next/link";
import { requireEntitlement } from "@/lib/auth-portals";
import { getCurrentUser } from "@/lib/auth";
import { getUserAccess, hasEntitlement } from "@/lib/access/resolve";
import { getJourneyHub } from "@/lib/client-journey/queries";
import { PageHeader } from "@/components/page-header";
import {
  basePathSatisfied,
  hasMentorshipDfy,
  pathLabel,
} from "@/lib/client-journey/credit-paths";
import { moneyUSD } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientUpgradePage() {
  await requireEntitlement("upgrade_center", "/client/dashboard");
  const me = await getCurrentUser();
  if (!me?.email) {
    return <p className="text-sm text-muted-foreground">Profile email required.</p>;
  }

  const access = await getUserAccess();
  const hub = await getJourneyHub(me.email, me.id);
  const baseOk = basePathSatisfied(hub.creditPlans);
  const mentorship = hasMentorshipDfy(hub.creditPlans);
  const operatorPortal =
    hub.operator.candidateUnlocked &&
    access &&
    hasEntitlement(access, "operator_candidate");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Credit paths & upgrades"
        description="Your team assigns Path A or B. Mentorship is the optional done-for-you tier."
        action={
          <Link href="/client/path" className="text-sm font-medium text-primary hover:underline">
            ← My path
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <article className="surface-card p-5">
          <p className="text-xs font-medium uppercase text-muted-foreground">Path A</p>
          <h3 className="mt-1 font-semibold">Up to {moneyUSD(97)}/mo</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Monthly enrollment with self-guided training. Waives the $250 + $250 payment plan.
          </p>
        </article>
        <article className="surface-card p-5">
          <p className="text-xs font-medium uppercase text-muted-foreground">Path B</p>
          <h3 className="mt-1 font-semibold">$250 + $250</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            If you are not on $97/mo: $250 down plus $250 balance due within 30–45 days.
          </p>
        </article>
        <article className="surface-card border-primary/30 p-5">
          <p className="text-xs font-medium uppercase text-muted-foreground">Path C</p>
          <h3 className="mt-1 font-semibold">{moneyUSD(1000)} mentorship</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Done for you — TMMT works through credit restoration with you. Requires Path A or B first.
          </p>
        </article>
      </section>

      {hub.creditPlans.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Your active plans</h2>
          <ul className="space-y-2">
            {hub.creditPlans.map((p) => (
              <li key={p.id} className="surface-card flex justify-between p-4 text-sm">
                <span>{pathLabel(p.credit_path)}</span>
                <span className="capitalize text-muted-foreground">{p.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-muted-foreground">
        {baseOk
          ? "Your base credit path is satisfied. "
          : "Ask TMMT to enroll you on Path A or B. "}
        {mentorship
          ? "Mentorship DFY is active."
          : baseOk
            ? "Contact TMMT to add Mentorship — Done for you ($1,000)."
            : ""}
      </p>

      <p className="text-sm">
        <Link href="/client/billing" className="text-primary hover:underline">
          View billing for credit charges →
        </Link>
      </p>

      {operatorPortal && (
        <section className="surface-card border-emerald-200/60 p-5">
          <h2 className="text-lg font-medium">Partner with TMMT</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Rubric score {hub.operator.profile?.rubric_score ?? "—"} — you qualify as an operator candidate.
            TMMT will reach out for discovery and onboarding.
          </p>
        </section>
      )}
      {hub.operator.candidateUnlocked && !operatorPortal && (
        <p className="text-sm text-muted-foreground">
          Operator candidacy is being finalized — check back after TMMT enables your partner portal access.
        </p>
      )}
    </div>
  );
}
