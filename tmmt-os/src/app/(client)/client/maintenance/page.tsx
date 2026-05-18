import Link from "next/link";
import { requireEntitlement } from "@/lib/auth-portals";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ColoredRow } from "@/components/colored-row";
import { CaseStatusBadge } from "@/components/case-status-badge";
import { createMaintenanceRequest } from "./actions";
import type { CaseStatus } from "@/lib/workflow/statuses";
import { getCaseStatusTone } from "@/lib/ui/status-colors";

export const dynamic = "force-dynamic";

export default async function ClientMaintenancePage() {
  await requireEntitlement("maintenance_requests", "/client/dashboard");
  const me = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: requests } = await supabase
    .from("cases")
    .select("id, ref_code, subject, status, created_at, description")
    .ilike("customer_email", me?.email ?? "")
    .eq("request_type", "maintenance")
    .order("created_at", { ascending: false })
    .limit(15);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Maintenance"
        description="Report issues during your rental. Urgent items are prioritized — mandatory service checks may also appear under My rental reminders."
        action={
          <Link href="/client/rental">
            <Button variant="outline" size="sm">
              My rental
            </Button>
          </Link>
        }
      />

      <Card className="border-t-4 border-t-orange-500">
        <CardHeader>
          <CardTitle>Submit maintenance request</CardTitle>
          <CardDescription>Describe the issue. Include noise, warning lights, tire wear, or scheduled service needs.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createMaintenanceRequest} className="max-w-lg space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" name="subject" required placeholder="e.g. Oil change due / check engine light" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle (optional)</Label>
              <Input id="vehicle" name="vehicle" placeholder="Plate or vehicle name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="urgency">Urgency</Label>
              <Select id="urgency" name="urgency" defaultValue="normal">
                <option value="normal">Normal — schedule when possible</option>
                <option value="soon">Soon — within 48 hours</option>
                <option value="urgent">Urgent — safety or breakdown</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="details">Details</Label>
              <Textarea id="details" name="details" rows={4} placeholder="What happened? When? Safe to drive?" />
            </div>
            <Button type="submit">Submit request</Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Your maintenance tickets</h2>
        {(requests ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No maintenance requests yet.</p>
        )}
        {(requests ?? []).map((r) => (
          <ColoredRow key={r.id} href={`/client/support/${r.id}`} tone={getCaseStatusTone(r.status as CaseStatus)}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{r.subject}</p>
                <p className="text-xs text-muted-foreground">{r.ref_code}</p>
              </div>
              <CaseStatusBadge status={r.status as CaseStatus} />
            </div>
          </ColoredRow>
        ))}
      </section>
    </div>
  );
}
