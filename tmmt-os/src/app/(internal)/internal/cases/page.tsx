import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CasesWorkspace } from "@/components/cases-workspace";
import { CASE_STATUSES } from "@/lib/workflow/statuses";
import { getBusinessLine, TMMT_BUSINESS_LINES } from "@/lib/business-lines/registry";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const LINE_IDS = new Set(TMMT_BUSINESS_LINES.map((b) => b.id));

export default async function CasesIndex({
  searchParams,
}: {
  searchParams: { status?: string; line?: string };
}) {
  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("cases")
    .select("id, ref_code, customer_name, request_type, subject, status, created_at, business_line")
    .order("created_at", { ascending: false })
    .limit(200);

  if (searchParams.status && (CASE_STATUSES as readonly string[]).includes(searchParams.status)) {
    q = q.eq("status", searchParams.status);
  }
  if (searchParams.line && LINE_IDS.has(searchParams.line as (typeof TMMT_BUSINESS_LINES)[number]["id"])) {
    q = q.eq("business_line", searchParams.line);
  }

  const { data: cases, error } = await q;
  const rows =
    error && error.message.toLowerCase().includes("business_line")
      ? await supabase
          .from("cases")
          .select("id, ref_code, customer_name, request_type, subject, status, created_at")
          .order("created_at", { ascending: false })
          .limit(200)
          .then((r) => r.data)
      : cases;

  const activeLine =
    searchParams.line && getBusinessLine(searchParams.line) ? searchParams.line : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cases"
        description="Kanban board and list view — filter by status or TMMT business line."
        action={
          <Link href="/intake">
            <Button>New intake</Button>
          </Link>
        }
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading views…</p>}>
        <CasesWorkspace
          cases={rows ?? []}
          activeStatus={searchParams.status}
          activeLine={activeLine}
        />
      </Suspense>
    </div>
  );
}
