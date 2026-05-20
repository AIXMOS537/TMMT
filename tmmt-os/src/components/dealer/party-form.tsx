"use client";

import { useState, useTransition } from "react";
import { savePartyAction } from "@/lib/dealer/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PartyForm({ compact }: { compact?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <form
      className={compact ? "flex flex-wrap items-end gap-3" : "surface-card space-y-4 p-6"}
      action={(fd) => {
        setError(null);
        start(async () => {
          const res = await savePartyAction(fd);
          if (!res.success) {
            setError(res.error);
            return;
          }
          setDone(true);
          window.location.reload();
        });
      }}
    >
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
      {done && <p className="w-full text-sm text-emerald-600">Buyer saved.</p>}
      <div className={compact ? "" : ""}>
        <Label htmlFor="full_name">Name</Label>
        <Input id="full_name" name="full_name" required className={compact ? "mt-1 w-40" : "mt-1"} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" className={compact ? "mt-1 w-48" : "mt-1"} />
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" className={compact ? "mt-1 w-36" : "mt-1"} />
      </div>
      <Button type="submit" size={compact ? "sm" : "default"} disabled={pending}>
        {pending ? "Saving…" : "Add buyer"}
      </Button>
    </form>
  );
}
