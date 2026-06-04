import type { CaseType, WorkType } from "@/lib/routing/types";
import type { DispatchWorkType } from "./types";

export type ProtocolStep =
  | "intake_created"
  | "routing"
  | "dispatch_load"
  | "agent_draft"
  | "ghl_notify"
  | "vendor_assignment"
  | "partner_app_delivery";

export type DispatchProtocol = {
  id: string;
  label: string;
  workTypes: WorkType[];
  caseType: CaseType;
  steps: ProtocolStep[];
};

/** Always notified for any dispatch job when webhook is configured. */
export const DISPATCH_HUB_SLUGS = [
  "vendor_connect",
  "freight_logistics",
  "fleet_manager",
] as const;

/**
 * GHL location slugs (partner_app_slug in PARTNER_APP_WEBHOOKS_JSON).
 * Only locations with a registered webhook URL receive the job.
 */
export const DISPATCH_VERTICAL_BY_WORK_TYPE: Record<DispatchWorkType, readonly string[]> = {
  dispatch_pickup: [
    "moving",
    "tmmt_rentals",
    "express",
    "auto",
    "wholesale-cars",
    "detailing",
  ],
  dispatch_delivery: [
    "moving",
    "tmmt_rentals",
    "express",
    "black",
    "luxury",
    "auto",
    "detailing",
    "wholesale-cars",
  ],
  dispatch_full: [
    "moving",
    "service_arbitrage",
    "cleaning",
    "tmmt_rentals",
    "express",
    "auto",
    "wholesale-cars",
    "tmmt_property",
  ],
};

/** Protocols run automatically when staff creates a dispatch job. */
export const DISPATCH_PROTOCOLS: DispatchProtocol[] = [
  {
    id: "dispatch_pickup",
    label: "Dispatch pickup",
    workTypes: ["dispatch_pickup"],
    caseType: "dispatch",
    steps: [
      "intake_created",
      "routing",
      "dispatch_load",
      "agent_draft",
      "ghl_notify",
      "vendor_assignment",
      "partner_app_delivery",
    ],
  },
  {
    id: "dispatch_delivery",
    label: "Dispatch delivery",
    workTypes: ["dispatch_delivery"],
    caseType: "dispatch",
    steps: [
      "intake_created",
      "routing",
      "dispatch_load",
      "agent_draft",
      "ghl_notify",
      "vendor_assignment",
      "partner_app_delivery",
    ],
  },
  {
    id: "dispatch_full",
    label: "Full dispatch (pickup + delivery)",
    workTypes: ["dispatch_full"],
    caseType: "dispatch",
    steps: [
      "intake_created",
      "routing",
      "dispatch_load",
      "agent_draft",
      "ghl_notify",
      "vendor_assignment",
      "partner_app_delivery",
    ],
  },
];

export function protocolForWorkType(workType: WorkType): DispatchProtocol {
  return (
    DISPATCH_PROTOCOLS.find((p) => p.workTypes.includes(workType)) ??
    DISPATCH_PROTOCOLS[DISPATCH_PROTOCOLS.length - 1]
  );
}

/** All GHL slugs to ring for a work type (hub + vertical). Deduped. */
export function defaultPartnerAppsForWorkType(workType: WorkType): string[] {
  const vertical = DISPATCH_VERTICAL_BY_WORK_TYPE[workType as DispatchWorkType] ?? [];
  return [...new Set([...DISPATCH_HUB_SLUGS, ...vertical])];
}
