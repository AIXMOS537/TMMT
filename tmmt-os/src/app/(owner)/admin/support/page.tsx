import Link from "next/link";
import { requireEntitlement } from "@/lib/auth-portals";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CaseStatusBadge } from "@/components/case-status-badge";
import { formatDate } from "@/lib/utils";
import type { CaseStatus } from "@/lib/workflow/statuses";

export const dynamic = "force-dynamic";

export default async function AdminSupportOverviewPage() {
  await requireEntitlement("admin_support_overview", "/admin/dashboard");
  const supabase = createSupabaseServerClient();

  const [{ data: openCases }, { data: fromPortal }] = await Promise.all([
    supabase
      .from("cases")
      .select("id, ref_code, customer_name, customer_email, subject, status, created_at")
      .not("status", "in", "(completed,closed)")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("cases")
      .select("id, ref_code, subject, status, created_at, metadata")
      .contains("metadata", { source: "client_portal" })
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <Link href="/admin/dashboard" className="text-sm text-muted-foreground hover:underline">
          ← Admin
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Support overview</h1>
        <p className="text-sm text-muted-foreground">
          Open cases across the system. Client portal tickets flow into the same case pipeline.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">From Client Portal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(fromPortal ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/internal/cases/${c.id}`}
              className="block border rounded-md p-3 hover:bg-accent"
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium">{c.subject}</span>
                <CaseStatusBadge status={c.status as CaseStatus} />
              </div>
              <span className="text-xs text-muted-foreground">
                {c.ref_code} · {formatDate(c.created_at)}
              </span>
            </Link>
          ))}
          {(fromPortal ?? []).length === 0 && (
            <p className="text-muted-foreground">No client-portal tickets yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All open cases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(openCases ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/internal/cases/${c.id}`}
              className="block border rounded-md p-3 hover:bg-accent"
            >
              <div className="flex justify-between gap-2">
                <span>
                  <span className="font-medium">{c.subject}</span>
                  <span className="text-muted-foreground"> · {c.customer_name}</span>
                </span>
                <CaseStatusBadge status={c.status as CaseStatus} />
              </div>
              <span className="text-xs text-muted-foreground block">
                {c.ref_code} · {formatDate(c.created_at)}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
