import { refreshApplicationScores, createInitialState } from "@aixmos/core";
import type { Application, AppState, AuditEntry } from "@aixmos/core";
import {
  applicationToPayload,
  rowToApplication,
  type ProgramApplicationRow,
} from "@aixmos/core";
import { createSSRClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isStaffUser } from "@/lib/auth-roles";
import { timingSafeEqualString } from "@/lib/ghl/webhook-auth";

export function getLearnBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_AIXMOS_LEARN_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const site = process.env.NEXT_PUBLIC_AIXMOS_SITE_URL ?? process.env.NEXT_PUBLIC_CUBE_WORK_URL;
  if (site) return `${site.replace(/\/$/, "")}/learn`;
  return "http://localhost:3000/learn";
}

export function learnDeepLink(applicationId: string, accessToken?: string): string {
  const base = getLearnBaseUrl();
  const params = new URLSearchParams({ applicationId });
  if (accessToken) params.set("token", accessToken);
  return `${base}/onboarding?${params.toString()}`;
}

export async function fetchAuditLog(applicationId: string): Promise<AuditEntry[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("program_audit_log")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id as string,
    timestamp: row.created_at as string,
    actor: row.actor_name as string,
    role: row.actor_role as AuditEntry["role"],
    action: row.action as string,
    fromStatus: row.from_status as AuditEntry["fromStatus"],
    toStatus: row.to_status as AuditEntry["toStatus"],
    notes: row.notes as string | undefined,
  }));
}

/**
 * Just enough of a row to decide whether the caller may have the rest of it.
 *
 * Kept separate from loadProgramApplication so the authorization check never
 * has to pull the payload — the thing it is deciding about — into memory first.
 */
export async function fetchApplicationGuard(
  applicationId: string
): Promise<{ email: string | null; accessToken: string | null } | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("program_applications")
    .select("email, access_token")
    .eq("id", applicationId)
    .maybeSingle();

  if (!data) return null;
  return {
    email: (data.email as string | null) ?? null,
    accessToken: (data.access_token as string | null) ?? null,
  };
}

/**
 * May this caller touch this application?
 *
 * Two ways in, matching the two ways the journey is legitimately reached: the
 * access token minted with the row and mailed out inside learnDeepLink, or a
 * signed-in session — staff get any application, everyone else only the one
 * filed under their own email.
 *
 * Shared rather than written twice. The cube API and the document upload both
 * run on the service role, so this is the only thing standing between a request
 * and someone's credit application; two copies of it would eventually disagree.
 */
export async function authorizeApplicationAccess(
  applicationId: string,
  suppliedToken: string | null
): Promise<{ ok: true; staff: boolean; userId: string | null } | { ok: false }> {
  const guard = await fetchApplicationGuard(applicationId);
  if (!guard) return { ok: false };

  if (
    suppliedToken &&
    guard.accessToken &&
    timingSafeEqualString(suppliedToken, guard.accessToken)
  ) {
    return { ok: true, staff: false, userId: null };
  }

  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  if (isStaffUser(user)) return { ok: true, staff: true, userId: user.id };

  const sessionEmail = user.email?.trim().toLowerCase();
  const ownerEmail = guard.email?.trim().toLowerCase();
  if (sessionEmail && ownerEmail && sessionEmail === ownerEmail) {
    return { ok: true, staff: false, userId: user.id };
  }

  return { ok: false };
}

export async function loadProgramApplication(
  applicationId: string
): Promise<AppState | null> {
  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase
    .from("program_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (error || !row) return null;
  const auditLog = await fetchAuditLog(applicationId);
  return {
    currentUser: {
      id: "client-preview",
      name: (row as ProgramApplicationRow).client_name || "Client",
      email: (row as ProgramApplicationRow).email,
      role: "client",
      onboardingComplete: (row as ProgramApplicationRow).status !== "onboarding",
      track: (row as ProgramApplicationRow).track as AppState["currentUser"]["track"],
    },
    application: rowToApplication(row as ProgramApplicationRow, auditLog),
  };
}

export async function saveProgramApplication(state: AppState): Promise<void> {
  const supabase = createServiceRoleClient();
  const app = refreshApplicationScores(state.application);
  const payload = applicationToPayload(app);

  const { error } = await supabase.from("program_applications").upsert({
    id: app.id,
    email: state.currentUser.email || "unknown@example.com",
    client_name: app.clientName,
    track: app.track,
    status: app.status,
    payload,
    overall_readiness: app.overallReadiness,
    client_consent_given: app.clientConsentGiven,
    consent_timestamp: app.consentTimestamp ?? null,
    submission_method: app.submissionMethod ?? null,
    submission_reference: app.submissionReference ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function createProgramApplicationFromGhl(input: {
  email: string;
  clientName?: string;
  ghlContactId?: string;
  tags?: string[];
  track?: Application["track"];
}): Promise<{ id: string; accessToken: string; learnUrl: string }> {
  const supabase = createServiceRoleClient();
  const seed = createInitialState("client");
  const app = refreshApplicationScores({
    ...seed.application,
    id: crypto.randomUUID(),
    clientName: input.clientName || input.email.split("@")[0],
    track: input.track ?? "personal",
    status: "onboarding",
  });

  const { data, error } = await supabase
    .from("program_applications")
    .insert({
      id: app.id,
      email: input.email,
      client_name: app.clientName,
      ghl_contact_id: input.ghlContactId ?? null,
      track: app.track,
      status: app.status,
      payload: applicationToPayload(app),
      overall_readiness: app.overallReadiness,
      source: "ghl",
    })
    .select("id, access_token")
    .single();

  if (error || !data) throw error ?? new Error("Insert failed");

  await supabase.from("program_audit_log").insert({
    application_id: data.id,
    actor_name: "GHL",
    actor_role: "admin",
    action: `Application created from GHL${input.tags?.length ? `: ${input.tags.join(", ")}` : ""}`,
    to_status: "onboarding",
  });

  return {
    id: data.id as string,
    accessToken: data.access_token as string,
    learnUrl: learnDeepLink(data.id as string, data.access_token as string),
  };
}
