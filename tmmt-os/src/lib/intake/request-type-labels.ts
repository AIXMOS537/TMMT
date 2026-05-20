import type { RequestType } from "@/lib/workflow/statuses";

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  rental_booking: "Rental booking",
  rental_support: "Rental support / change",
  maintenance: "Maintenance",
  repair: "Repair",
  detail: "Detail / cleaning",
  tow: "Tow",
  inspection: "Inspection",
  delivery: "Delivery / driver",
  content: "Content / media",
  consulting: "Consulting / coaching",
  other: "Other",
};
