import Link from "next/link";
import { requireEntitlement } from "@/lib/auth-portals";
import { getCurrentUser } from "@/lib/auth";
import { getJourneyHub } from "@/lib/client-journey/queries";
import { pathLabel, hasMentorshipDfy } from "@/lib/client-journey/credit-paths";
import { PageHeader } from "@/components/page-header";
import { EducationAckForm } from "@/components/client-journey/education-ack-form";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ClientCreditPage() {
  await requireEntitlement("credit_education_hub", "/client/dashboard");
  const me = await getCurrentUser();
  if (!me?.email) {
    return <p className="text-sm text-muted-foreground">Profile email required.</p>;
  }

  const hub = await getJourneyHub(me.email, me.id);
  const mentorship = hasMentorshipDfy(hub.creditPlans);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Credit repair"
        description="Why credit repair matters on your rental path — and how enrollment works with TMMT."
        action={
          <Link href="/client/path" className="text-sm font-medium text-primary hover:underline">
            My path
          </Link>
        }
      />

      <section className="surface-card space-y-4 p-5">
        <h2 className="text-lg font-medium">Your enrollment</h2>
        {hub.creditPlans.filter((p) => !p.is_add_on).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            TMMT assigns Path A ($97/mo) or Path B ($250 + $250) at active rental. Contact support to choose now.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {hub.creditPlans.map((p) => (
              <li key={p.id} className="flex justify-between gap-4">
                <span>{pathLabel(p.credit_path)}</span>
                <span className="capitalize text-muted-foreground">{p.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Why credit repair (required)</h2>
        {hub.education.sections.map((s) => (
          <article key={s.id} className="surface-card space-y-3 p-5">
            <h3 className="font-medium">{s.title}</h3>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{s.body_md}</p>
            <EducationAckForm sectionId={s.id} acknowledged={s.acknowledged} />
          </article>
        ))}
      </section>

      {mentorship && (
        <p className="text-sm text-emerald-700">Mentorship — Done for you is active.</p>
      )}

      {!mentorship && hub.gates.basePathSatisfied && (
        <p className="text-sm text-muted-foreground">
          Want TMMT to rebuild with you? See{" "}
          <Link href="/client/upgrade" className="text-primary underline">
            Mentorship ($1,000)
          </Link>
          .
        </p>
      )}

      <div className="flex gap-3">
        <Link href="/client/training">
          <Button>Training</Button>
        </Link>
        <Link href="/client/billing">
          <Button variant="outline">Billing</Button>
        </Link>
      </div>
    </div>
  );
}
