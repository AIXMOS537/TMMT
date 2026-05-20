"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acknowledgeEducationSectionAction } from "@/lib/client-journey/actions";

export function EducationAckForm({
  sectionId,
  acknowledged,
}: {
  sectionId: string;
  acknowledged: boolean;
}) {
  const [pending, start] = useTransition();

  if (acknowledged) {
    return <p className="text-sm text-emerald-600 font-medium">Acknowledged</p>;
  }

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() => start(() => acknowledgeEducationSectionAction(sectionId))}
    >
      {pending ? "Saving…" : "I understand — acknowledge"}
    </Button>
  );
}
