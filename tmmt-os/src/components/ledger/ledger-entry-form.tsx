import { createLedgerEntry } from "@/lib/ledger/actions";
import { LEDGER_ENTRY_TYPES, LEDGER_TYPE_LABEL } from "@/lib/ledger/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LedgerEntryForm({
  defaultEmail,
  defaultName,
  defaultCaseId,
  sourceLabel,
}: {
  defaultEmail?: string;
  defaultName?: string;
  defaultCaseId?: string;
  sourceLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Post financial entry</CardTitle>
        <CardDescription>
          Updates sync to customer billing, internal ledger, and partner views ({sourceLabel}).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createLedgerEntry} className="grid gap-4 max-w-xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer_email">Customer email</Label>
              <Input
                id="customer_email"
                name="customer_email"
                type="email"
                required
                defaultValue={defaultEmail}
                placeholder="renter@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer name</Label>
              <Input id="customer_name" name="customer_name" defaultValue={defaultName} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entry_type">Type</Label>
              <Select id="entry_type" name="entry_type" defaultValue="expense" required>
                {LEDGER_ENTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LEDGER_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0" required placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="e.g. Tire replacement / Deposit hold" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" name="description" rows={2} placeholder="Notes visible on billing when enabled below" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue="pending">
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>
            <div className="space-y-2 flex flex-col justify-end">
              <input type="hidden" name="visible_to_client" value="off" />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="visible_to_client"
                  value="on"
                  defaultChecked
                  className="rounded border-input"
                />
                Show on customer billing
              </label>
              <p className="text-xs text-muted-foreground">Uncheck for internal-only expenses.</p>
            </div>
          </div>
          {defaultCaseId && <input type="hidden" name="case_id" value={defaultCaseId} />}
          <Button type="submit">Post entry</Button>
        </form>
      </CardContent>
    </Card>
  );
}
