import { SYNC_STATUS_LABEL, type SyncRecordStatus } from "@/lib/crm-sync/labels";
import { SYNC_STATUS_TONE } from "@/lib/ui/status-colors";
import { StatusBadge } from "@/components/status-badge";

export function SyncStatusBadge({ status }: { status: SyncRecordStatus }) {
  const key = status in SYNC_STATUS_LABEL ? status : "pending_verification";
  return <StatusBadge label={SYNC_STATUS_LABEL[key]} tone={SYNC_STATUS_TONE[key]} />;
}
