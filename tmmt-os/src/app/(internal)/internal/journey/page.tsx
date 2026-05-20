import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { JourneyEmailLookup } from "@/components/client-journey/journey-email-lookup";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InternalJourneyIndexPage() {
  await requireRole(["admin", "internal_team"]);
  const supabase = createSupabaseServerClient();
  const { data: journeys } = await supabase
    .from("client_journey")
    .select("customer_email, program_track, lto_eligible, good_standing_days, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Client journey"
        description="Credit paths, training progress, and LTO eligibility. Open a renter by email."
      />

      <JourneyEmailLookup />

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Recent journeys</h2>
        {!journeys?.length ? (
          <p className="text-sm text-muted-foreground">
            No journeys yet. Open a renter by email after migration 0014 is applied in Supabase.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {journeys.map((j) => (
              <li key={j.customer_email} className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href={`/internal/journey/${encodeURIComponent(j.customer_email)}`}
                  className="font-medium text-primary hover:underline"
                >
                  {j.customer_email}
                </Link>
                <span className="text-muted-foreground">
                  {j.program_track}
                  {j.lto_eligible ? " · LTO" : ""} · {j.good_standing_days}d GS ·{" "}
                  {formatDate(j.updated_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
