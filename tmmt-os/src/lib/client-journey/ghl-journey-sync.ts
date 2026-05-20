import {
  addContactTag,
  findGhlContactByEmail,
  isGhlJourneyConfigured,
  updateContactCustomFields,
} from "@/lib/ghl/client";
import { ghlTagForPath } from "./credit-paths";
import type { CreditPath, OperatorGhlStage, OperatorLevel } from "./types";

const JOURNEY_LOC = "restoration" as const;

async function journeyContactId(email: string): Promise<string | null> {
  if (!isGhlJourneyConfigured()) return null;
  return findGhlContactByEmail(email, {
    location: JOURNEY_LOC,
    tryFallbackLocation: true,
  });
}

export async function syncJourneyCreditTag(email: string, path: CreditPath): Promise<void> {
  const contactId = await journeyContactId(email);
  if (!contactId) return;
  await addContactTag(contactId, ghlTagForPath(path), JOURNEY_LOC);
  await updateContactCustomFields(contactId, { journey_credit_path: path }, JOURNEY_LOC);
}

export async function syncLtoEligibleTag(email: string): Promise<void> {
  const contactId = await journeyContactId(email);
  if (!contactId) return;
  await addContactTag(contactId, "lto:eligible", JOURNEY_LOC);
}

export async function syncLtoInProgressTag(email: string): Promise<void> {
  const contactId = await journeyContactId(email);
  if (!contactId) return;
  await addContactTag(contactId, "lto:in-progress", JOURNEY_LOC);
}

export function operatorGhlStageForScore(score: number, level: OperatorLevel): OperatorGhlStage {
  if (level === "master" || score >= 90) return "First revenue";
  if (level === "senior" || score >= 85) return "Onboarding";
  if (score >= 80) return "Agreement signed";
  if (level === "certified" || score >= 75) return "Certified";
  if (score >= 70) return "Discovery complete";
  if (score >= 65) return "Discovery scheduled";
  if (score >= 60) return "Warmed";
  if (score >= 50) return "Identified";
  return "Identified";
}

export async function syncOperatorToGhl(
  email: string,
  stage: string,
  score: number
): Promise<void> {
  const contactId = await journeyContactId(email);
  if (!contactId) return;

  if (score >= 60) await addContactTag(contactId, "operator:candidate", JOURNEY_LOC);
  if (score >= 70) await addContactTag(contactId, "operator:certified", JOURNEY_LOC);

  await updateContactCustomFields(
    contactId,
    {
      operator_rubric_score: String(score),
      operator_pipeline_stage: stage,
    },
    JOURNEY_LOC
  );
}
