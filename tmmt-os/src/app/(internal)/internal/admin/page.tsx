import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AGENT_REGISTRY } from "@/lib/agents/registry";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole(["admin"]);
  const supabase = createSupabaseServerClient();

  const [
    { count: openCases },
    { count: pendingSync },
    { data: recentActivity },
    { data: agentSessions },
  ] = await Promise.all([
    supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(completed,closed)"),
    supabase
      .from("crm_sync_records")
      .select("id", { count: "exact", head: true })
      .in("sync_status", ["pending_airtable", "pending_verification"]),
    supabase
      .from("activity_logs")
      .select("entity, action, created_at, data")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("agent_evaluation_sessions")
      .select("id, subject_type, subject_id, status, decision, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Admin console</h1>
        <p className="text-sm text-muted-foreground">
          AIXMOS governance — agents, activity, and ecosystem health.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open cases</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{openCases ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CRM sync pending</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{pendingSync ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent panel</CardTitle>
            <CardDescription>3-of-5 approval model</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {Object.values(AGENT_REGISTRY)
              .map((a) => a.label)
              .join(" · ")}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(recentActivity ?? []).map((row, i) => (
              <div key={i} className="border-b pb-2 last:border-0">
                <span className="font-medium">{row.entity}</span> · {row.action}
                <span className="text-xs text-muted-foreground block">
                  {formatDate(row.created_at)}
                </span>
              </div>
            ))}
            {(recentActivity ?? []).length === 0 && (
              <p className="text-muted-foreground">No activity yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent evaluations</CardTitle>
            <CardDescription>Requires migration 0004</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(agentSessions ?? []).map((s) => (
              <div key={s.id} className="border rounded-md p-2">
                <div className="font-medium">
                  {s.subject_type} · {s.status}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(s.created_at)}
                  {s.decision ? ` · ${s.decision}` : ""}
                </span>
              </div>
            ))}
            {(agentSessions ?? []).length === 0 && (
              <p className="text-muted-foreground">No evaluation sessions yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
