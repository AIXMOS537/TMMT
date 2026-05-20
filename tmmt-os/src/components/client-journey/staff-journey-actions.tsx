"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  assignCreditBasePathAction,
  assignMentorshipDfyAction,
  markPaymentPlanCompleteAction,
} from "@/lib/client-journey/actions";
import type { BaseCreditPath } from "@/lib/client-journey/types";

export function StaffJourneyActions({ email }: { email: string }) {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => start(() => assignCreditBasePathAction(email, "monthly_97" as BaseCreditPath))}
      >
        Assign Path A ($97/mo)
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(() => assignCreditBasePathAction(email, "payment_plan_500" as BaseCreditPath))
        }
      >
        Assign Path B ($250+$250)
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => start(() => markPaymentPlanCompleteAction(email))}
      >
        Mark plan B paid
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => start(() => assignMentorshipDfyAction(email))}
      >
        Add mentorship ($1k)
      </Button>
    </div>
  );
}
