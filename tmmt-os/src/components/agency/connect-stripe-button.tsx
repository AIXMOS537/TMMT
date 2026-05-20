"use client";

import { useTransition } from "react";
import { startAgencyConnectOnboarding } from "@/lib/stripe/connect";
import { Button } from "@/components/ui/button";

export function ConnectStripeButton({
  agencyOrgId,
  connected,
}: {
  agencyOrgId: string;
  connected: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <Button
      variant={connected ? "outline" : "default"}
      disabled={pending}
      onClick={() => start(() => startAgencyConnectOnboarding(agencyOrgId))}
    >
      {pending ? "Opening Stripe…" : connected ? "Update Stripe Connect" : "Connect Stripe payouts"}
    </Button>
  );
}
