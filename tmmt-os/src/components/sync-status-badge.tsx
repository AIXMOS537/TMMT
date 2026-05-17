import { Badge } from "@/components/ui/badge";
import { SYNC_STATUS_LABEL, type SyncRecordStatus } from "@/lib/crm-sync/labels";

const VARIANT: Record<
  SyncRecordStatus,
  "default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "info"
> = {
  pending_airtable: "info",
  pending_verification: "warning",
  verified: "success",
  rejected: "destructive",
  error: "destructive",
};

export function SyncStatusBadge({ status }: { status: SyncRecordStatus }) {
  const key = status in SYNC_STATUS_LABEL ? status : "pending_verification";
  return <Badge variant={VARIANT[key]}>{SYNC_STATUS_LABEL[key]}</Badge>;
}
