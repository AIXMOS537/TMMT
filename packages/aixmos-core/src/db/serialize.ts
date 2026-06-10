import type { AppState, Application, AuditEntry } from "../types";

export type ProgramApplicationRow = {
  id: string;
  access_token: string;
  ghl_contact_id: string | null;
  email: string;
  client_name: string;
  track: string;
  status: string;
  payload: Record<string, unknown>;
  overall_readiness: number;
  client_consent_given: boolean;
  consent_timestamp: string | null;
  submission_method: string | null;
  submission_reference: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export function applicationToPayload(app: Application): Record<string, unknown> {
  const { id, clientName, track, status, overallReadiness, clientConsentGiven, consentTimestamp, submissionMethod, submissionReference, createdAt, updatedAt, ...rest } = app;
  return {
    ...rest,
    clientName,
    track,
    status,
    overallReadiness,
    clientConsentGiven,
    consentTimestamp,
    submissionMethod,
    submissionReference,
    createdAt,
    updatedAt,
  };
}

export function rowToApplication(row: ProgramApplicationRow, auditLog: AuditEntry[] = []): Application {
  const payload = (row.payload ?? {}) as Partial<Application>;
  return {
    id: row.id,
    clientName: row.client_name || payload.clientName || "",
    track: (row.track as Application["track"]) || "personal",
    status: row.status as Application["status"],
    personal: payload.personal,
    business: payload.business,
    documents: payload.documents ?? [],
    readiness: payload.readiness ?? [],
    overallReadiness: row.overall_readiness ?? payload.overallReadiness ?? 0,
    coachingInsights: payload.coachingInsights ?? [],
    productMatches: payload.productMatches ?? [],
    advisorNotes: payload.advisorNotes ?? "",
    adminNotes: payload.adminNotes ?? "",
    supervisorNotes: payload.supervisorNotes ?? "",
    clientConsentGiven: row.client_consent_given,
    consentTimestamp: row.consent_timestamp ?? undefined,
    submissionMethod: (row.submission_method as Application["submissionMethod"]) ?? undefined,
    submissionReference: row.submission_reference ?? undefined,
    auditLog: auditLog.length ? auditLog : (payload.auditLog as AuditEntry[]) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function stateFromRow(row: ProgramApplicationRow, auditLog: AuditEntry[] = []): AppState {
  return {
    currentUser: {
      id: "client-preview",
      name: row.client_name || "Client",
      email: row.email,
      role: "client",
      onboardingComplete: row.status !== "onboarding",
      track: row.track as AppState["currentUser"]["track"],
    },
    application: rowToApplication(row, auditLog),
  };
}
