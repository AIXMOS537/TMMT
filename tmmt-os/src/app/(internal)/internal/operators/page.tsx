import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { OperatorRubricForm } from "@/components/client-journey/operator-rubric-form";
import { RevenueSplitForm } from "@/components/client-journey/revenue-split-form";
import { OPERATOR_GHL_STAGES } from "@/lib/client-journey/types";
import { moneyUSD } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InternalOperatorsPage() {
  await requireRole(["admin", "internal_team"]);
  const supabase = createSupabaseServerClient();
  const { data: operators } = await supabase
    .from("operator_profiles")
    .select("id, customer_email, level, rubric_score, revenue_share_pct, ghl_pipeline_stage")
    .order("rubric_score", { ascending: false })
    .limit(50);

  const opIds = (operators ?? []).map((o) => o.id);
  const { data: splits } =
    opIds.length > 0
      ? await supabase
          .from("revenue_splits")
          .select(
            "id, operator_id, gross_cents, platform_cents, operator_cents, partner_cents, agency_cents, partner_pct, agency_pct, split_tier, status"
          )
          .in("operator_id", opIds)
          .order("created_at", { ascending: false })
          .limit(20)
      : { data: [] };

  const emailByOpId = new Map((operators ?? []).map((o) => [o.id, o.customer_email]));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Operators"
        description="7-category rubric (100 pts). ≥70 flags operator candidate; 60–69 GHL nurture only. Bands: 90+ master, 75+ senior, 70+ certified."
      />

      <OperatorRubricForm />

      <RevenueSplitForm />

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Operator profiles</h2>
        {!operators?.length ? (
          <p className="text-sm text-muted-foreground">No operator scores yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {operators.map((o) => (
              <li
                key={o.customer_email}
                className="flex flex-col gap-1 p-4 sm:flex-row sm:justify-between"
              >
                <Link
                  href={`/internal/journey/${encodeURIComponent(o.customer_email)}`}
                  className="font-medium text-primary hover:underline"
                >
                  {o.customer_email}
                </Link>
                <span className="text-muted-foreground">
                  {o.level} · {o.rubric_score}/100 · {o.revenue_share_pct}% share
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Revenue splits</h2>
        {!splits?.length ? (
          <p className="text-sm text-muted-foreground">No split rows yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {splits.map((s) => (
                <li key={s.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:justify-between">
                  <span>{emailByOpId.get(s.operator_id) ?? "—"}</span>
                  <span className="text-muted-foreground">
                    {moneyUSD(s.gross_cents / 100)} gross
                    {s.partner_pct != null ? (
                      <>
                        {" "}
                        · {s.partner_pct}/{s.agency_pct} · partner{" "}
                        {moneyUSD((s.partner_cents ?? s.operator_cents) / 100)} · TMMT{" "}
                        {moneyUSD((s.agency_cents ?? s.platform_cents) / 100)}
                      </>
                    ) : (
                      <>
                        {" "}
                        · TMMT {moneyUSD(s.platform_cents / 100)} · op{" "}
                        {moneyUSD(s.operator_cents / 100)}
                      </>
                    )}{" "}
                    · {s.status}
                    {s.split_tier ? ` · ${s.split_tier.replace("_", "/")}` : ""}
                  </span>
                </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        GHL operator pipeline: {OPERATOR_GHL_STAGES.join(" → ")}.
      </p>
    </div>
  );
}
