"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { linkGhlContactAction } from "@/app/(internal)/internal/cases/[id]/link-ghl-actions";

type Props = {
  caseId: string;
  refCode: string;
  customerEmail: string | null;
  ghlContactId: string | null;
  ghlConfigured: boolean;
};

export function LinkGhlContactForm({
  caseId,
  refCode,
  customerEmail,
  ghlContactId,
  ghlConfigured,
}: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  async function onSubmit(formData: FormData) {
    setMessage(null);
    setOk(null);
    const result = await linkGhlContactAction(formData);
    setOk(result.ok);
    setMessage(result.message);
  }

  return (
    <Card className="border-amber-200/80 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-base">Link GHL contact</CardTitle>
        <CardDescription>
          Case ref <span className="font-mono font-medium">{refCode}</span> — syncs merge fields for
          workflows. Contact ID: GHL URL …/contacts/detail/
          <span className="font-mono">ID</span>
        </CardDescription>
        {!ghlConfigured && (
          <p className="text-sm text-destructive font-medium">
            GHL API keys missing on this environment — sync will fail until Vercel env is set.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="grid sm:grid-cols-2 gap-3">
          <input type="hidden" name="case_id" value={caseId} />
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="customer_email">Customer email (must match GHL)</Label>
            <Input
              id="customer_email"
              name="customer_email"
              type="email"
              required
              defaultValue={customerEmail ?? ""}
              placeholder="renter@example.com"
            />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="ghl_contact_id">GHL contact ID (required for reliable sync)</Label>
            <Input
              id="ghl_contact_id"
              name="ghl_contact_id"
              required
              defaultValue={ghlContactId ?? ""}
              placeholder="e.g. abc123XYZ"
              className="font-mono text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={!ghlConfigured}>
              Save & sync portal fields to GHL
            </Button>
            {message && (
              <p
                className={`text-sm mt-2 ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}
              >
                {message}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
