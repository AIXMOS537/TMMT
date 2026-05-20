"use client";

import { useState, useTransition } from "react";
import { suspendClientOrganization, unsuspendClientOrganization } from "@/lib/agency/actions";
import { Button } from "@/components/ui/button";

export function ClientOrgActions({
  orgId,
  suspended,
}: {
  orgId: string;
  suspended: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      {suspended ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await unsuspendClientOrganization(orgId);
            })
          }
        >
          {pending ? "…" : "Unsuspend"}
        </Button>
      ) : confirmSuspend ? (
        <>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await suspendClientOrganization(orgId);
                setConfirmSuspend(false);
              })
            }
          >
            {pending ? "…" : "Confirm suspend"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setConfirmSuspend(false)}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => setConfirmSuspend(true)}
        >
          Suspend
        </Button>
      )}
    </div>
  );
}
