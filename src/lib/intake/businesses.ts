import type { RequestType } from "@/lib/workflow/statuses";
import {
  listIntakeLines,
  type BusinessLineId,
} from "@/lib/business-lines/registry";

export type IntakeBusinessSlug = string;

export type IntakeBusinessConfig = {
  slug: IntakeBusinessSlug;
  title: string;
  description: string;
  business_line: BusinessLineId;
  requestTypes: RequestType[];
  subjectPlaceholder: string;
  detailsPlaceholder: string;
  accent: string;
};

/** Intake forms — one page per line, derived from the business-line registry. */
export const INTAKE_BUSINESSES: IntakeBusinessConfig[] = listIntakeLines().map((line) => ({
  slug: line.intake!.slug,
  title: line.intake!.title,
  description: line.intake!.description,
  business_line: line.id,
  requestTypes: line.intake!.requestTypes,
  subjectPlaceholder: line.intake!.subjectPlaceholder,
  detailsPlaceholder: line.intake!.detailsPlaceholder,
  accent: line.intake!.accent,
}));

export function getIntakeBusiness(slug: string): IntakeBusinessConfig | undefined {
  return INTAKE_BUSINESSES.find((b) => b.slug === slug);
}

export function isAllowedRequestType(business: IntakeBusinessConfig, type: string): boolean {
  return (business.requestTypes as string[]).includes(type);
}
