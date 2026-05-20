"use client";

import { useState, useTransition } from "react";
import { provisionClientOrganization } from "@/lib/agency/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PartnerSplitFields } from "@/components/agency/partner-split-fields";

export function ProvisionClientForm({ parentAgencyId }: { parentAgencyId?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      action={(fd) => {
        setError(null);
        start(async () => {
          const res = await provisionClientOrganization(fd);
          if (!res.success) setError(res.error);
        });
      }}
    >
      {parentAgencyId && <input type="hidden" name="parent_agency_id" value={parentAgencyId} />}
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
      <div>
        <Label htmlFor="name">Client name</Label>
        <Input id="name" name="name" required className="mt-1 w-48" placeholder="ABC Motors" />
      </div>
      <div>
        <Label htmlFor="vertical">Vertical</Label>
        <select
          id="vertical"
          name="vertical"
          defaultValue="dealer"
          className="mt-1 flex h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="dealer">Dealer (LotOS)</option>
          <option value="rental">Rental</option>
        </select>
      </div>
      <div className="w-full border-t pt-4 mt-2">
        <p className="text-xs font-medium text-muted-foreground mb-2">Partner / agency revenue split</p>
        <PartnerSplitFields idPrefix="provision" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add client"}
      </Button>
    </form>
  );
}
