"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { isStaffUser } from "@/lib/auth-roles";
import type { OrgRole } from "@/lib/db-vocab";
import { searchAddress } from "@/lib/osm-geocode";
import { askCaptainDispatch } from "@/lib/captain-client";
import { notifyResponder } from "@/lib/notify-telegram";
import type { Candidate, AssignmentReasoning, Incident } from "@/lib/dispatch-types";
import { OrgIdSchema } from "@/lib/agent/tenant";

const NewIncidentSchema = z.object({
  org_id: OrgIdSchema,
  reporter_name: z.string().min(1).max(120).optional(),
  reporter_phone: z.string().max(40).optional(),
  location_lat: z.number().refine(n => n >= -90 && n <= 90, "lat out of range"),
  location_lng: z.number().refine(n => n >= -180 && n <= 180, "lng out of range"),
  location_text: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  required_capabilities: z.array(z.string().max(64)).max(20).default([]),
  required_class: z.string().nullable().optional(),
});

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireAuth() {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/**
 * Being signed in is not the same as belonging to an organisation.
 *
 * requireAuth() only asks whether there is a user, and every export below used
 * to stop there. Several of them take the org id from the caller, so "signed
 * in" was enough to file an incident into someone else's organisation — and, on
 * approveResponderLink, to approve yourself as an active responder in it.
 * dispatch/layout.tsx already had the right rule (staff, or a row in org_roles);
 * it just could not defend the actions, because a server action is dispatched
 * by id rather than by URL and never passes through the layout that guards its
 * page.
 *
 * Roles per the schema: ORG_ROLES in src/lib/db-vocab.ts (tenant_admin,
 * dispatcher, responder, viewer). The subset below is type-checked against it.
 */
const ORG_ADMIN_ROLES = ["tenant_admin", "dispatcher"] as const satisfies readonly OrgRole[];

async function requireOrgAccess(
  orgId: string | null | undefined,
  need: "member" | "admin" = "member"
): Promise<ActionResult<{ supabase: Awaited<ReturnType<typeof createSSRClient>>; user: NonNullable<Awaited<ReturnType<typeof requireAuth>>["user"]> }>> {
  const { supabase, user } = await requireAuth();

  // Staff run every org's dispatch, same as the layout allows.
  if (isStaffUser(user)) return { ok: true, data: { supabase, user } };

  if (!orgId) return { ok: false, error: "not authorized" };

  const { data } = await supabase
    .from("org_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId);

  const roles = (data ?? []).map((r) => String((r as { role: unknown }).role));
  if (roles.length === 0) return { ok: false, error: "not authorized" };

  if (need === "admin" && !roles.some((r) => (ORG_ADMIN_ROLES as readonly string[]).includes(r))) {
    return { ok: false, error: "not authorized" };
  }

  return { ok: true, data: { supabase, user } };
}

/** The org a unit belongs to — never taken from the caller. */
async function orgForUnit(
  supabase: Awaited<ReturnType<typeof createSSRClient>>,
  unitId: string
): Promise<string | null> {
  const { data } = await supabase.from("units").select("org_id").eq("id", unitId).maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

/** The org an incident belongs to — never taken from the caller. */
async function orgForIncident(
  supabase: Awaited<ReturnType<typeof createSSRClient>>,
  incidentId: string
): Promise<string | null> {
  const { data } = await supabase.from("incidents").select("org_id").eq("id", incidentId).maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

export async function geocodeAddress(query: string): Promise<ActionResult<Array<{ label: string; lat: number; lng: number }>>> {
  await requireAuth();
  const results = await searchAddress(query);
  return { ok: true, data: results.map(r => ({ label: r.place_name, lat: r.center[1], lng: r.center[0] })) };
}

export async function createIncident(input: unknown): Promise<ActionResult<{ incident_id: string; ref_code: string }>> {
  const parsed = NewIncidentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" };
  // org_id arrives from the caller, so it has to be checked, not trusted.
  const access = await requireOrgAccess(parsed.data.org_id);
  if (!access.ok) return access;
  const { supabase, user } = access.data;

  const { data: refRow, error: refErr } = await supabase.rpc("next_dsp_ref_code");
  if (refErr) return { ok: false, error: "ref_code generation failed" };
  const ref_code = refRow as unknown as string;

  const { data: inserted, error } = await supabase
    .from("incidents")
    .insert({
      org_id: parsed.data.org_id,
      ref_code,
      reporter_name: parsed.data.reporter_name ?? null,
      reporter_phone: parsed.data.reporter_phone ?? null,
      location_lat: parsed.data.location_lat,
      location_lng: parsed.data.location_lng,
      location_text: parsed.data.location_text,
      description: parsed.data.description ?? null,
      severity: parsed.data.severity,
      required_capabilities: parsed.data.required_capabilities,
      required_class: parsed.data.required_class ?? null,
      status: "assigning",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[createIncident] insert failed", error);
    return { ok: false, error: "could not save incident" };
  }
  const incidentId = inserted.id as string;

  await runAssignment(incidentId);

  return { ok: true, data: { incident_id: incidentId, ref_code } };
}

async function runAssignment(incidentId: string): Promise<void> {
  const supabase = await createSSRClient();
  const { data: candidatesRaw, error: candErr } = await supabase.rpc("find_best_unit", { p_incident_id: incidentId });
  if (candErr) { console.error("[runAssignment] find_best_unit failed", candErr); return; }
  const candidates = (candidatesRaw ?? []) as Candidate[];

  if (candidates.length === 0) {
    await supabase.from("incidents").update({ status: "received" }).eq("id", incidentId);
    return;
  }

  const { data: incRow } = await supabase.from("incidents").select("*").eq("id", incidentId).maybeSingle();
  const incident = incRow as Incident | null;
  if (!incident) return;

  const captain = await askCaptainDispatch({
    incident: {
      severity: incident.severity,
      location: incident.location_lat !== null && incident.location_lng !== null
        ? [incident.location_lat, incident.location_lng] : null,
      required_capabilities: incident.required_capabilities,
      description: incident.description,
    },
    candidates,
  });

  const pickId = captain ? captain.ranked_unit_ids[0] : candidates[0].unit_id;
  const pickIndex = candidates.findIndex(c => c.unit_id === pickId);

  const reasoning: AssignmentReasoning = {
    captain_used: !!captain,
    captain_skipped: !captain,
    candidates,
    pick_index: pickIndex,
    ...(captain ? { captain_text: captain.reasoning } : {}),
  };

  const { data: { user } } = await supabase.auth.getUser();
  await supabase.rpc("assign_unit", {
    p_incident_id: incidentId,
    p_unit_id: pickId,
    p_by_kind: "system",
    p_by_user: user?.id ?? null,
    p_weight: 0,
    p_reasoning: reasoning,
  });

  const { data: unitRow } = await supabase.from("units").select("responder_id, callsign").eq("id", pickId).maybeSingle();
  await notifyResponder({
    responderId: (unitRow?.responder_id as string | null) ?? null,
    text: `TENTATIVE assignment for ${incident.ref_code}. May change in 30s.\nLocation: ${incident.location_text}`,
    fetchChatId: async (uid) => {
      const { data } = await supabase.from("profiles").select("telegram_chat_id").eq("id", uid).maybeSingle();
      return (data?.telegram_chat_id as string | null) ?? null;
    },
  });
}

const OverrideSchema = z.object({
  incident_id: z.string().uuid(),
  current_assignment_id: z.string().uuid(),
  chosen_unit_id: z.string().uuid(),
  reason: z.string().min(1).max(2000),
});

export async function overrideAssignment(input: unknown): Promise<ActionResult<{ assignment_id: string }>> {
  const parsed = OverrideSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const { supabase: reader } = await requireAuth();

  const { data: current } = await reader.from("incident_assignments_v")
    .select("*").eq("id", parsed.data.current_assignment_id).maybeSingle();
  if (!current) return { ok: false, error: "assignment not found" };

  // The org comes off the assignment, never off the request.
  const access = await requireOrgAccess((current as { org_id?: string }).org_id);
  if (!access.ok) return access;
  const { supabase, user } = access.data;

  if ((current as { effective_status?: string }).effective_status === "locked") {
    return { ok: false, error: "override window expired" };
  }

  // T-03 finding: the org check above covers the assignment row only. The
  // incident and the chosen unit also come from the caller, so pin both to
  // that row's org before anything is written: the incident must be the one
  // this assignment belongs to, and the unit must live in the same org.
  // `incident_assignments_v` exposes incident_id and `units` carries org_id
  // (verified against prod 2026-09-08). Same error text as "not found" so a
  // probing caller learns nothing about records in other orgs.
  const currentOrgId = (current as { org_id: string }).org_id;
  const currentIncidentId = (current as { incident_id?: string }).incident_id;
  if (currentIncidentId !== parsed.data.incident_id) {
    return { ok: false, error: "assignment not found" };
  }
  const { data: chosenUnit } = await supabase.from("units")
    .select("id")
    .eq("id", parsed.data.chosen_unit_id)
    .eq("org_id", currentOrgId)
    .maybeSingle();
  if (!chosenUnit) return { ok: false, error: "unit not found" };

  await supabase.from("incident_assignments")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.current_assignment_id);

  await supabase.from("units")
    .update({ status: "available", active_assignment_id: null })
    .eq("id", (current as { unit_id: string }).unit_id);

  await supabase.from("assignment_overrides").insert({
    org_id: currentOrgId,
    incident_id: currentIncidentId,
    original_unit_id: (current as { unit_id: string }).unit_id,
    chosen_unit_id: parsed.data.chosen_unit_id,
    reason: parsed.data.reason,
    context: (current as { reasoning_json: unknown }).reasoning_json,
  });

  const { data: newAssignment, error } = await supabase.rpc("assign_unit", {
    p_incident_id: currentIncidentId,
    p_unit_id: parsed.data.chosen_unit_id,
    p_by_kind: "user",
    p_by_user: user.id,
    p_weight: 1.0,
    p_reasoning: {
      captain_used: false,
      captain_skipped: true,
      candidates: [],
      pick_index: -1,
      override_reason: parsed.data.reason,
    } satisfies AssignmentReasoning,
  });
  if (error) return { ok: false, error: "override failed" };

  const { data: prevUnit } = await supabase.from("units").select("responder_id, callsign")
    .eq("id", (current as { unit_id: string }).unit_id).maybeSingle();
  if (prevUnit?.responder_id) {
    await notifyResponder({
      responderId: prevUnit.responder_id as string,
      text: `ASSIGNMENT CHANGED — your previous incident has been reassigned to another unit.`,
      fetchChatId: async (uid) => {
        const { data } = await supabase.from("profiles").select("telegram_chat_id").eq("id", uid).maybeSingle();
        return (data?.telegram_chat_id as string | null) ?? null;
      },
    });
  }

  const id = (newAssignment as { id: string } | null)?.id ?? "";
  return { ok: true, data: { assignment_id: id } };
}

const TransitionSchema = z.object({
  incident_id: z.string().uuid(),
  to_status: z.enum(["en_route","on_scene","cleared","closed","cancelled"]),
});

export async function transitionStatus(input: unknown): Promise<ActionResult<null>> {
  const parsed = TransitionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const { supabase: reader } = await requireAuth();
  const access = await requireOrgAccess(
    await orgForIncident(reader, parsed.data.incident_id)
  );
  if (!access.ok) return access;
  const { supabase } = access.data;

  const patch: Record<string, unknown> = { status: parsed.data.to_status };
  if (parsed.data.to_status === "closed" || parsed.data.to_status === "cancelled" || parsed.data.to_status === "cleared") {
    patch.closed_at = new Date().toISOString();
  }
  const { error } = await supabase.from("incidents").update(patch).eq("id", parsed.data.incident_id);
  if (error) return { ok: false, error: "transition failed" };

  const unitStatus = parsed.data.to_status === "en_route" ? "en_route"
                  : parsed.data.to_status === "on_scene" ? "on_scene"
                  : parsed.data.to_status === "cleared" || parsed.data.to_status === "closed" || parsed.data.to_status === "cancelled" ? "available"
                  : null;
  if (unitStatus) {
    const { data: ia } = await supabase.from("incident_assignments_v").select("unit_id")
      .eq("incident_id", parsed.data.incident_id)
      .eq("effective_status", "locked")
      .maybeSingle();
    if (ia?.unit_id) {
      await supabase.from("units").update({
        status: unitStatus,
        ...(unitStatus === "available" ? { active_assignment_id: null } : {}),
      }).eq("id", ia.unit_id as string);
    }
  }
  return { ok: true, data: null };
}

export async function lockExpiredAssignments(orgId: string): Promise<ActionResult<{ locked: number }>> {
  if (!OrgIdSchema.safeParse(orgId).success) return { ok: false, error: "invalid id" };
  const access = await requireOrgAccess(orgId);
  if (!access.ok) return access;
  const { supabase } = access.data;
  const { data, error } = await supabase.rpc("lock_expired_assignments", { p_org_id: orgId });
  if (error) return { ok: false, error: "lock tick failed" };
  return { ok: true, data: { locked: (data as number | null) ?? 0 } };
}

const SetUnitStatusSchema = z.object({
  unit_id: z.string().uuid(),
  status: z.enum(["off_duty","available","out_of_service"]),
});

export async function setUnitStatus(input: unknown): Promise<ActionResult<null>> {
  const parsed = SetUnitStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const { supabase: reader } = await requireAuth();
  const access = await requireOrgAccess(await orgForUnit(reader, parsed.data.unit_id));
  if (!access.ok) return access;
  const { supabase } = access.data;
  const { error } = await supabase.from("units").update({ status: parsed.data.status }).eq("id", parsed.data.unit_id);
  return error ? { ok: false, error: "update failed" } : { ok: true, data: null };
}

const SetUnitLocationSchema = z.object({
  unit_id: z.string().uuid(),
  lat: z.number().refine(n => n >= -90 && n <= 90),
  lng: z.number().refine(n => n >= -180 && n <= 180),
});

export async function setUnitLocation(input: unknown): Promise<ActionResult<null>> {
  const parsed = SetUnitLocationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  const { supabase: reader } = await requireAuth();
  const unitOrg = await orgForUnit(reader, parsed.data.unit_id);
  const access = await requireOrgAccess(unitOrg);
  if (!access.ok) return access;
  const { supabase } = access.data;
  const now = new Date().toISOString();
  const { error: updErr } = await supabase.from("units").update({
    current_lat: parsed.data.lat,
    current_lng: parsed.data.lng,
    last_ping_at: now,
  }).eq("id", parsed.data.unit_id);
  if (updErr) return { ok: false, error: "update failed" };

  const { data: u } = await supabase.from("units").select("org_id").eq("id", parsed.data.unit_id).maybeSingle();
  if (u?.org_id) {
    await supabase.from("unit_locations").insert({
      org_id: u.org_id as string,
      unit_id: parsed.data.unit_id,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    });
  }
  return { ok: true, data: null };
}

const ApproveResponderSchema = z.object({
  org_id: OrgIdSchema,
  user_id: z.string().uuid(),
  link_kind: z.enum(["vendor","operator","client_volunteer","contractor"]),
  certs: z.record(z.string(), z.unknown()).optional(),
});

export async function approveResponderLink(input: unknown): Promise<ActionResult<null>> {
  const parsed = ApproveResponderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid input" };
  // This grants someone the right to be dispatched. Membership is not enough —
  // otherwise a responder in an org could approve themselves into any role in
  // it, and anyone at all could name an org they have never belonged to.
  const access = await requireOrgAccess(parsed.data.org_id, "admin");
  if (!access.ok) return access;
  const { supabase, user } = access.data;
  const { error } = await supabase.from("org_responder_links").upsert({
    org_id: parsed.data.org_id,
    user_id: parsed.data.user_id,
    link_kind: parsed.data.link_kind,
    approved_at: new Date().toISOString(),
    approved_by: user.id,
    certs: parsed.data.certs ?? {},
    active: true,
  });
  return error ? { ok: false, error: "approve failed" } : { ok: true, data: null };
}

export async function revokeResponderLink(linkId: string): Promise<ActionResult<null>> {
  if (!z.string().uuid().safeParse(linkId).success) return { ok: false, error: "invalid id" };
  const { supabase: reader } = await requireAuth();
  const { data: link } = await reader
    .from("org_responder_links")
    .select("org_id")
    .eq("id", linkId)
    .maybeSingle();
  const access = await requireOrgAccess((link?.org_id as string | undefined) ?? null, "admin");
  if (!access.ok) return access;
  const { supabase } = access.data;
  const { error } = await supabase.from("org_responder_links").update({ active: false }).eq("id", linkId);
  return error ? { ok: false, error: "revoke failed" } : { ok: true, data: null };
}
