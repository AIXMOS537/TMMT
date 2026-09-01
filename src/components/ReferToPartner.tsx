"use client";

import { useState } from "react";
import { Handshake, Check } from "lucide-react";
import { Button, FormField, inputClass, selectClass } from "@/components/ui";
import {
  referToPartner,
  CONSENT_CHANNELS,
  type ConsentChannel,
} from "@/app/(admin)/referral-actions";

/**
 * Offer someone the credit partner, and record that they said yes.
 *
 * Deliberately not a one-click button. The consent channel is required because
 * enforce_handoff_consent() will block the partner from accepting a referral
 * that has none — so a button that skipped it would create referrals that can
 * never be actioned, which is worse than no button.
 *
 * The offer is made to anyone who does not get a rental straight away, and to
 * renters who ask for it. That breadth is what keeps it clean: it is a service
 * offer, not a response to a decline, so nobody is being told they were turned
 * down because of their credit.
 */
export function ReferToPartner({
  contactRef,
  defaultReason = "",
  compact = false,
}: {
  contactRef: string;
  defaultReason?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<ConsentChannel | "">("");
  const [reason, setReason] = useState(defaultReason);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="h-4 w-4" />
        Referred
      </span>
    );
  }

  if (!open) {
    return (
      <Button variant="secondary" size={compact ? "sm" : "md"} onClick={() => setOpen(true)}>
        <Handshake className="h-4 w-4" />
        Refer for credit help
      </Button>
    );
  }

  async function submit() {
    if (!channel) {
      setError("Record how they agreed first.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await referToPartner({ contactRef, reason, consentChannel: channel });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone(true);
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-3 text-left">
      <p className="text-xs text-gray-600 dark:text-slate-400">
        Referring <span className="font-medium text-gray-900 dark:text-slate-100">{contactRef}</span> to
        Khan Strategies. Their details are only released once the partner accepts.
      </p>

      <FormField label="How did they agree?" required>
        <select
          className={selectClass}
          value={channel}
          onChange={(e) => setChannel(e.target.value as ConsentChannel)}
        >
          <option value="">Select…</option>
          {CONSENT_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c.replace("_", " ")}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Reason">
        <input
          className={inputClass}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. no vehicle available, wants to improve credit first"
        />
      </FormField>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? "Recording…" : "Record referral"}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
