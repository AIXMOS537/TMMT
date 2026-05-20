import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ContactFirstBanner } from "@/components/contact-first-banner";
import { formatDate } from "@/lib/utils";
import { requestInvestorUpdate } from "./actions";

export const dynamic = "force-dynamic";

export default async function InvestorContactPage() {
  const me = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: requests } = await supabase
    .from("cases")
    .select("id, ref_code, subject, status, created_at, description")
    .ilike("customer_email", me?.email ?? "")
    .eq("request_type", "investor_inquiry")
    .order("created_at", { ascending: false })
    .limit(15);

  const { data: updates } = await supabase
    .from("investor_updates")
    .select("title, body, published_at, created_at")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Request an update</h1>
        <p className="text-sm text-muted-foreground">
          Published investor memos and your open requests — check here before calling the team.
        </p>
      </header>

      <ContactFirstBanner variant="public" />

      <Card>
        <CardHeader>
          <CardTitle>Ask the team</CardTitle>
          <CardDescription>
            We route this to ops like any other case. You will get a reference number to track status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={requestInvestorUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Topic</Label>
              <Input id="subject" name="subject" required placeholder="Q1 distribution, fleet expansion, etc." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="details">Details (optional)</Label>
              <Textarea id="details" name="details" rows={4} placeholder="What you need to know…" />
            </div>
            <Button type="submit">Submit request</Button>
          </form>
        </CardContent>
      </Card>

      {(updates ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent published updates</CardTitle>
            <CardDescription>
              <Link href="/investor/dashboard" className="underline">
                View all on dashboard
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(updates ?? []).map((u, i) => (
              <div key={i} className="border-b last:border-0 py-2">
                <p className="font-medium">{u.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(u.published_at ?? u.created_at)}
                </p>
                {u.body && <p className="text-sm mt-1 line-clamp-3">{u.body}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(requests ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No open requests yet.</p>
          )}
          {(requests ?? []).map((r) => (
            <div key={r.id} className="flex flex-wrap items-start justify-between gap-2 border-b last:border-0 py-2">
              <div>
                <p className="font-medium">{r.subject}</p>
                <p className="text-xs font-mono text-muted-foreground">{r.ref_code}</p>
                <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
              </div>
              <span className="text-sm capitalize">{String(r.status).replace(/_/g, " ")}</span>
            </div>
          ))}
          {(requests ?? []).length > 0 && (
            <Link href={`/track?ref=${encodeURIComponent(requests![0].ref_code ?? "")}`}>
              <Button variant="outline" size="sm">
                Track latest on public page
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
