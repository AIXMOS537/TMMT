import { CANONICAL_STAGE_LABEL } from "@/lib/crm-sync/labels";
import type { CanonicalRenterStage } from "@/lib/crm-sync/types";
import { CANONICAL_STAGE_TONE } from "@/lib/ui/status-colors";
import { StatusBadge } from "@/components/status-badge";

export function CanonicalStageBadge({ stage }: { stage: CanonicalRenterStage }) {
  const tone = CANONICAL_STAGE_TONE[stage] ?? "slate";
  return <StatusBadge label={CANONICAL_STAGE_LABEL[stage] ?? stage} tone={tone} />;
}
