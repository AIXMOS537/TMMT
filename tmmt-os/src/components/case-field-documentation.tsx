"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { addDamageReportAction, uploadCaseMediaAction } from "@/app/(internal)/internal/cases/[id]/field-actions";

type Props = {
  caseId: string;
  customerEmail: string;
};

export function CaseFieldDocumentation({ caseId, customerEmail }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onDamage(formData: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      await addDamageReportAction(formData);
      setMessage("Damage report saved — client sees it when marked visible.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save damage report");
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(formData: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      await uploadCaseMediaAction(formData);
      setMessage("Photo uploaded.");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-base">Field documentation</CardTitle>
        <p className="text-sm text-muted-foreground">
          For in-person operators — photos and damage notes sync to the client vehicle hub.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={onDamage} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="case_id" value={caseId} />
          <input type="hidden" name="customer_email" value={customerEmail} />
          <div className="sm:col-span-2">
            <Label htmlFor="damage_title">Damage title</Label>
            <Input id="damage_title" name="title" required placeholder="Driver side door ding" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="damage_desc">Details</Label>
            <Textarea id="damage_desc" name="description" rows={2} placeholder="Size, location, when noticed…" />
          </div>
          <div>
            <Label htmlFor="severity">Severity</Label>
            <Select id="severity" name="severity" defaultValue="minor">
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="major">Major</option>
            </Select>
          </div>
          <label className="flex items-end gap-2 text-sm pb-2">
            <input type="hidden" name="visible_to_client" value="off" />
            <input type="checkbox" name="visible_to_client" defaultChecked className="rounded" />
            Show on client hub
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              Log damage
            </Button>
          </div>
        </form>

        <form action={onPhoto} className="grid gap-3">
          <input type="hidden" name="case_id" value={caseId} />
          <input type="hidden" name="customer_email" value={customerEmail} />
          <div>
            <Label htmlFor="photo">Photo / document</Label>
            <Input
              ref={fileRef}
              id="photo"
              name="file"
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              required
              className="text-sm"
            />
          </div>
          <div>
            <Label htmlFor="caption">Caption</Label>
            <Input id="caption" name="caption" placeholder="Pickup inspection — odometer" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="hidden" name="visible_to_client" value="off" />
            <input type="checkbox" name="visible_to_client" defaultChecked className="rounded" />
            Show on client hub
          </label>
          <Button type="submit" disabled={busy} variant="outline" className="w-full sm:w-auto">
            Upload photo
          </Button>
        </form>

        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}
