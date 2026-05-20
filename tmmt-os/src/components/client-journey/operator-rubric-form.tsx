"use client";

import { FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveOperatorRubricAction } from "@/lib/client-journey/actions";
import { RUBRIC_CATEGORIES, RUBRIC_CATEGORY_MAX } from "@/lib/client-journey/types";

const RUBRIC_LABELS: Record<(typeof RUBRIC_CATEGORIES)[number], string> = {
  consistent_results: "Consistent results",
  community_leadership: "Community leadership",
  platform_engagement: "Platform engagement",
  coachability: "Coachability",
  communication_skill: "Communication skill",
  network_audience: "Network / audience",
  financial_readiness: "Financial readiness",
};

export function OperatorRubricForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [pending, start] = useTransition();
  const month = new Date().toISOString().slice(0, 7) + "-01";

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const scores: Record<string, number> = {};
    for (const cat of RUBRIC_CATEGORIES) {
      scores[cat] = Number(form.get(cat) ?? 0);
    }
    start(() => saveOperatorRubricAction(email.trim().toLowerCase(), scores, month));
  }

  return (
    <form onSubmit={onSubmit} className="surface-card max-w-lg space-y-4 p-5">
      <div>
        <label className="text-sm font-medium" htmlFor="op-email">
          Client email
        </label>
        <input
          id="op-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {RUBRIC_CATEGORIES.map((cat) => (
          <div key={cat}>
            <label className="text-xs font-medium" htmlFor={cat}>
              {RUBRIC_LABELS[cat]} (max {RUBRIC_CATEGORY_MAX[cat]})
            </label>
            <input
              id={cat}
              name={cat}
              type="number"
              min={0}
              max={RUBRIC_CATEGORY_MAX[cat]}
              defaultValue={0}
              className="mt-1 w-full rounded-md border border-input px-2 py-1 text-sm"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Total max 100. Score ≥70 flags operator candidate in TMMT OS; 60–69 adds GHL nurture tag only.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save rubric"}
      </Button>
    </form>
  );
}
