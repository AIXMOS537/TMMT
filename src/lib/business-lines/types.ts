import type { RequestType } from "@/lib/workflow/statuses";

/** Canonical id on cases, CRM sync, and routing */
export type BusinessLineId =
  | "rentals"
  | "express"
  | "black"
  | "auto"
  | "detailing"
  | "moving"
  | "cleaning"
  | "wholesale-cars"
  | "luxury"
  | "restoration"
  | "management";

export type IntakeLineConfig = {
  slug: string;
  title: string;
  description: string;
  requestTypes: RequestType[];
  subjectPlaceholder: string;
  detailsPlaceholder: string;
  accent: string;
};

export type TmmtBusinessLine = {
  id: BusinessLineId;
  name: string;
  shortName: string;
  tagline?: string;
  description: string;
  role: "primary_public" | "public_intake" | "command_center_only";
  intake?: IntakeLineConfig;
};
