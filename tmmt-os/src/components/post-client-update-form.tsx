"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { postClientUpdateAction } from "@/app/(internal)/internal/cases/[id]/client-update-actions";

type Props = {
  caseId: string;
  customerEmail: string;
  refCode: string;
};

export function PostClientUpdateForm({ caseId, customerEmail, refCode }: Props) {
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    try {
      await postClientUpdateAction(formData);
      setMessage("Update posted — client sees it on Updates and their ticket.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to post");
    }
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-base">Post update to client</CardTitle>
        <CardDescription>
          Plain-language update visible on their portal — reduces phone calls asking &quot;what&apos;s
          the status?&quot;
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-3">
          <input type="hidden" name="case_id" value={caseId} />
          <input type="hidden" name="customer_email" value={customerEmail} />
          <input type="hidden" name="ref_code" value={refCode} />
          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              rows={3}
              required
              placeholder="e.g. Inspection scheduled for Tuesday 2pm. No action needed from you."
            />
          </div>
          <Button type="submit" size="sm">
            Post to client portal
          </Button>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
