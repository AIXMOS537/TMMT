import { VENDOR_JOB_LABEL, type VendorJobStatus } from "@/lib/workflow/statuses";
import { VENDOR_JOB_TONE } from "@/lib/ui/status-colors";
import { StatusBadge } from "@/components/status-badge";

export function JobStatusBadge({ status }: { status: VendorJobStatus }) {
  return (
    <StatusBadge label={VENDOR_JOB_LABEL[status]} tone={VENDOR_JOB_TONE[status] ?? "slate"} />
  );
}
