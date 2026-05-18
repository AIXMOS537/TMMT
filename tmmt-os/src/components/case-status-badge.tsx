import { CASE_STATUS_LABEL, type CaseStatus } from "@/lib/workflow/statuses";
import { getCaseStatusTone } from "@/lib/ui/status-colors";
import { StatusBadge } from "@/components/status-badge";

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <StatusBadge label={CASE_STATUS_LABEL[status]} tone={getCaseStatusTone(status)} />;
}
