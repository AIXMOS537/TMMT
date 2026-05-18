import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CasesWorkspace } from "@/components/cases-workspace";
import { CASE_STATUSES } from "@/lib/workflow/statuses";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CasesIndex({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("cases")
    .select("id, ref_code, customer_name, request_type, subject, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (searchParams.status && (CASE_STATUSES as readonly string[]).includes(searchParams.status)) {
    q = q.eq("status", searchParams.status);
  }
  const { data: cases } = await q;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cases"
        description="Kanban board and list view — color-coded by status for quick scanning."
        action={
          <Link href="/intake">
            <Button>New intake</Button>
          </Link>
        }
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading views…</p>}>
        <CasesWorkspace cases={cases ?? []} activeStatus={searchParams.status} />
      </Suspense>
    </div>
  );
}
