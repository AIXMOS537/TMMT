import { REQUEST_TYPE_TONE } from "@/lib/ui/status-colors";
import type { RequestType } from "@/lib/workflow/statuses";
import { StatusBadge } from "@/components/status-badge";

const LABEL: Record<RequestType, string> = {
  rental_booking: "Rental booking",
  rental_support: "Rental support",
  maintenance: "Maintenance",
  repair: "Repair",
  detail: "Detail",
  tow: "Tow",
  inspection: "Inspection",
  delivery: "Delivery",
  content: "Content",
  consulting: "Consulting",
  other: "Other",
};

export function RequestTypeBadge({ type }: { type: RequestType | string }) {
  const key = type as RequestType;
  const tone = REQUEST_TYPE_TONE[key] ?? "slate";
  const label = LABEL[key] ?? String(type).replace(/_/g, " ");
  return <StatusBadge label={label} tone={tone} dot={false} />;
}
