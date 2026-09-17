/**
 * The renter's own application status. Reached by a staff-minted link.
 *
 * OWNER DECISION 2026-09-16: a client sees their own background check once it comes
 * back, and nothing before that.
 *
 * This is a server component on purpose. The token is resolved server-side through
 * a service-role RPC and never reaches client JavaScript, matching the existing
 * licence-upload path. There is no client bundle here to leak it into.
 */
import type { Metadata } from "next";
import { getClientBgStatus, getClientJourneyForToken } from "@/lib/client-self-service";
import { loadLadderEvidence } from "@/lib/drive-to-own/queries";
import { evaluateLadder } from "@/lib/drive-to-own/ladder";
import { assessStanding } from "@/lib/drive-to-own/standing";
import { assessFinancingReadiness } from "@/lib/drive-to-own/financing-readiness";
import { createServiceRoleClient } from "@/lib/supabase-service";
import JourneyLadder from "@/components/drive-to-own/JourneyLadder";
import FinancingReadinessPanel from "@/components/drive-to-own/FinancingReadinessPanel";
import OwnershipOptIn from "@/components/drive-to-own/OwnershipOptIn";
import CreditEducation from "@/components/drive-to-own/CreditEducation";
import { loadEducationProgress } from "@/lib/drive-to-own/education";
import { loadTraining } from "@/lib/drive-to-own/training";
import TrainingModules from "@/components/drive-to-own/TrainingModules";
import { recordMetCheckpoints } from "@/lib/drive-to-own/checkpoint-events";
import { Card } from "@/components/ui";
import { CheckCircle, Clock, FileText, XCircle } from "lucide-react";
import BrandName from "@/components/brand/BrandName";

// A status page must never be cached or indexed — it is one person's record.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

function DocRow({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle className="h-4 w-4 shrink-0 text-green-500" aria-hidden />
      ) : (
        <Clock className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
      )}
      <span>{label}</span>
      <span className="ml-auto text-xs opacity-70">{ok ? "Received" : "Still needed"}</span>
    </li>
  );
}

export default async function ClientStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const status = await getClientBgStatus(token);

  // The ownership journey is shown only when this renter unambiguously has one. No
  // journey, or an ambiguous email, renders nothing rather than someone else's progress.
  const journey = status ? await getClientJourneyForToken(token) : null;
  let ladder = null;
  let standing = null;
  let education = null;
  let training = null;
  if (journey) {
    const svc = createServiceRoleClient();
    // Only loaded once they have chosen this path — see the opt-in note below.
    if (journey.ownership_opt_in_at) {
      education = await loadEducationProgress(svc, journey.id);
      training = await loadTraining(svc, journey.id);
    }
    ladder = evaluateLadder(await loadLadderEvidence(svc, journey));

    // Write down what they have cleared. Idempotent by the table's UNIQUE(journey, slug),
    // so running it on every view costs one refused insert rather than a duplicate. A
    // failure here must never take the renter's page down — they still get to see it.
    if (journey.ownership_opt_in_at) {
      try {
        await recordMetCheckpoints(svc, journey.id, ladder);
      } catch (e) {
        console.error("[status] checkpoint record failed", e);
      }
    }
    standing = assessStanding({
      overduePayments: null,
      oldestOverdueDays: null,
      // Production: 0 of 308 tickets carry customer_linked, so tolls are not attributable.
      obligations: { attributable: false, unpaidCount: null, oldestUnpaidDays: null },
      missedInspections: null,
      onRestrictionList: null,
    });
  }

  // No credit report is on file for anyone yet, so this renders the invitation to pull one.
  const readiness = journey
    ? assessFinancingReadiness(null, null, {
        goodStandingDays: journey.good_standing_days,
        goodStanding: journey.good_standing,
        paymentsFurnished: null,
      })
    : null;

  // Unknown, expired, revoked and malformed all land here — deliberately the same
  // answer, so this page cannot be used to probe which links exist.
  if (!status) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <Card>
          <h1 className="text-xl font-semibold">This link is no longer active</h1>
          <p className="mt-2 text-sm opacity-80">
            Application links expire for your security. Ask us for a fresh link and
            we&apos;ll send one over.
          </p>
        </Card>
      </main>
    );
  }

  const eligible = status.eligibility_status?.toLowerCase().startsWith("eligible");

  return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <Card>
        <p className="text-xs uppercase tracking-wide opacity-70">
          <BrandName /> · Your application
        </p>

        {!status.decided ? (
          <>
            <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
              <Clock className="h-5 w-5 text-amber-500" aria-hidden />
              We&apos;re reviewing your application
            </h1>
            <p className="mt-2 text-sm opacity-80">
              Nothing is needed from you right now. We&apos;ll be in touch as soon as
              it&apos;s done.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
              {eligible ? (
                <CheckCircle className="h-5 w-5 text-green-500" aria-hidden />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" aria-hidden />
              )}
              {eligible ? "You’re approved" : "We couldn’t approve this application"}
            </h1>

            {/* Shown only when the reason's category is customer-facing. When the RPC
                withholds it, say nothing about why rather than inventing a reason. */}
            {status.reason_label && (
              <div className="mt-3 rounded-md border border-white/10 p-3">
                <p className="text-sm font-medium">{status.reason_label}</p>
                {status.reason_description && (
                  <p className="mt-1 text-sm opacity-80">{status.reason_description}</p>
                )}
                {status.recoverable && (
                  <p className="mt-2 text-sm opacity-80">
                    This one can usually be resolved — reach out and we&apos;ll walk you
                    through it.
                  </p>
                )}
              </div>
            )}

            {status.date_verified && (
              <p className="mt-3 text-xs opacity-70">Reviewed {status.date_verified}</p>
            )}
          </>
        )}
      </Card>

      {/* Opted in -> show the journey. Not opted in -> offer it, and show nothing else.
          A renter who never asked for this should not arrive at a page grading their credit. */}
      {journey && !journey.ownership_opt_in_at && <OwnershipOptIn token={token} />}

      {journey?.ownership_opt_in_at && education && education.requiredTotal > 0 && (
        <CreditEducation
          token={token}
          sections={education.sections}
          requiredTotal={education.requiredTotal}
        />
      )}

      {journey?.ownership_opt_in_at && training && training.modules.length > 0 && (
        <TrainingModules
          token={token}
          modules={training.modules}
          coreTotal={training.coreTotal}
        />
      )}

      {journey?.ownership_opt_in_at && ladder && (
        <JourneyLadder position={ladder} standing={standing} />
      )}

      {journey?.ownership_opt_in_at && readiness && (
        <FinancingReadinessPanel readiness={readiness} />
      )}

      <Card>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4" aria-hidden />
          Your documents
        </h2>
        <ul className="mt-3 space-y-2">
          <DocRow ok={status.has_license} label="Driver’s licence" />
          <DocRow ok={status.has_insurance_proof} label="Proof of insurance" />
          <DocRow ok={status.has_paystub} label="Proof of income" />
          <DocRow ok={status.verification_form_submitted} label="Verification form" />
        </ul>
        <p className="mt-3 text-xs opacity-70">
          We show whether we received each item, never the document itself.
        </p>
      </Card>
    </main>
  );
}
