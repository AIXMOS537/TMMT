import { Badge } from "@/components/ui/badge";
import { CANONICAL_STAGE_LABEL } from "@/lib/crm-sync/labels";
import type { CanonicalRenterStage } from "@/lib/crm-sync/types";

export function CanonicalStageBadge({ stage }: { stage: CanonicalRenterStage }) {
  return <Badge variant="outline">{CANONICAL_STAGE_LABEL[stage] ?? stage}</Badge>;
}
