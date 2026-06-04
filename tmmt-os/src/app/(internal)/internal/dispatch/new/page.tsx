import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitDispatchJobAction } from "./actions";
import { DISPATCH_WORK_TYPES } from "@/lib/job-dispatch/types";

export const dynamic = "force-dynamic";

const WORK_TYPE_LABELS: Record<(typeof DISPATCH_WORK_TYPES)[number], string> = {
  dispatch_pickup: "Pickup only",
  dispatch_delivery: "Delivery only",
  dispatch_full: "Full move (pickup + delivery)",
};

export default async function NewDispatchJobPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, company_name")
    .eq("active", true)
    .order("company_name");

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="New dispatch job"
        description="Local vendor outsources work to TMMT — triggers routing, protocols, and partner app delivery."
        action={
          <Link href="/internal/dispatch">
            <Button variant="outline" size="sm">
              Back to loads
            </Button>
          </Link>
        }
      />

      {searchParams.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Vendor outsourcing details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submitDispatchJobAction} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="vendor_company">Local vendor company *</Label>
                <Input
                  id="vendor_company"
                  name="vendor_company"
                  required
                  placeholder="e.g. Ace Auto Body — outsourcing pickup"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor_contact_name">Contact name</Label>
                <Input id="vendor_contact_name" name="vendor_contact_name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor_contact_email">Contact email</Label>
                <Input id="vendor_contact_email" name="vendor_contact_email" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor_contact_phone">Contact phone</Label>
                <Input id="vendor_contact_phone" name="vendor_contact_phone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="work_type">Dispatch type *</Label>
                <Select id="work_type" name="work_type" defaultValue="dispatch_full">
                  {DISPATCH_WORK_TYPES.map((wt) => (
                    <option key={wt} value={wt}>
                      {WORK_TYPE_LABELS[wt]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign_vendor_id">Assign TMMT vendor now (optional)</Label>
                <Select id="assign_vendor_id" name="assign_vendor_id" defaultValue="">
                  <option value="">— Offer later —</option>
                  {(vendors ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.company_name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Job title *</Label>
              <Input
                id="subject"
                name="subject"
                required
                placeholder="e.g. Vehicle transport — shop to auction"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="details">Details</Label>
              <Textarea
                id="details"
                name="details"
                rows={4}
                placeholder="Vehicle info, access notes, special handling…"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pickup">Pickup address</Label>
                <Input id="pickup" name="pickup" placeholder="123 Main St, City" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dropoff">Dropoff address</Label>
                <Input id="dropoff" name="dropoff" placeholder="456 Oak Ave, City" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="window_start">Window start</Label>
                <Input id="window_start" name="window_start" type="datetime-local" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="window_end">Window end</Label>
                <Input id="window_end" name="window_end" type="datetime-local" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offered_price">Offered price ($)</Label>
                <Input id="offered_price" name="offered_price" type="number" step="0.01" min="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_at">Due by</Label>
                <Input id="due_at" name="due_at" type="datetime-local" />
              </div>
            </div>

            <Button type="submit" className="w-full sm:w-auto">
              Create dispatch job & run protocols
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What happens next</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Case created with dispatch work type and routing rules applied.</p>
          <p>2. ClickUp task, agent draft, and dispatch load row created when configured.</p>
          <p>3. GHL tags and stage sync fire if GHL is connected.</p>
          <p>4. Job payload POSTed to registered GHL inbound webhooks (flat `tmmt_*` keys).</p>
          <p>
            Auto-routes to hub apps (Vendor Connect, Freight, Fleet) plus vertical locations
            (Moving, Rentals, Auto, etc.) when webhooks are configured. See{" "}
            <code className="text-xs">docs/GHL_DISPATCH_SETUP.md</code>.
          </p>
          <p>
            Configure webhooks via <code>PARTNER_APP_WEBHOOKS_JSON</code> or{" "}
            <code>partner_app_endpoints</code> in Supabase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
