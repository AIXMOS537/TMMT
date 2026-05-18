import Link from "next/link";
import { requireEntitlement } from "@/lib/auth-portals";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CaseStatusBadge } from "@/components/case-status-badge";
import { formatDate } from "@/lib/utils";
import { createSupportCase } from "./actions";
import type { CaseStatus } from "@/lib/workflow/statuses";

export const dynamic = "force-dynamic";

export default async function ClientSupportPage() {
  await requireEntitlement("support_tickets", "/client/dashboard");
  const me = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: cases } = await supabase
    .from("cases")
    .select("id, ref_code, subject, status, created_at, description")
    .eq("customer_email", me?.email ?? "")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/client/dashboard" className="text-sm text-muted-foreground hover:underline">
          ← Client portal
        </Link>
        <h1 className="text-2xl font-semibold">Support tickets</h1>
        <p className="text-sm text-muted-foreground">
          Requests are tracked as TMMT cases — your ops team sees them in{" "}
          <Link href="/internal/cases" className="underline">
            Internal → Cases
          </Link>
          .
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Open a ticket</CardTitle>
          <CardDescription>We&apos;ll email updates to {me?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createSupportCase} className="space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" name="subject" required placeholder="Brief summary" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="details">Details</Label>
              <Textarea
                id="details"
                name="details"
                rows={4}
                placeholder="What do you need help with?"
              />
            </div>
            <Button type="submit">Submit ticket</Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Your tickets</h2>
        {(cases ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No tickets yet.</p>
        )}
        {(cases ?? []).map((c) => (
          <Card key={c.id}>
            <CardContent className="pt-6 flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{c.subject}</div>
                <p className="text-xs text-muted-foreground">
                  {c.ref_code} · {formatDate(c.created_at)}
                </p>
                {c.description && (
                  <p className="text-sm text-muted-foreground mt-2">{c.description}</p>
                )}
              </div>
              <CaseStatusBadge status={c.status as CaseStatus} />
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
