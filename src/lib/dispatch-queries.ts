import "server-only";
import { createSSRClient } from "@/lib/supabase-server";
import type {
  Incident, Unit, IncidentAssignment, UnitLocation,
} from "./dispatch-types";

export async function getDispatchCockpitData(orgId: string): Promise<{
  incidents: Incident[];
  units: Unit[];
}> {
  const supabase = await createSSRClient();
  const [inc, un] = await Promise.all([
    supabase.from("incidents").select("*")
      .eq("org_id", orgId)
      .in("status", ["received","assigning","assigned","en_route","on_scene"])
      .order("reported_at", { ascending: false }),
    supabase.from("units").select("*")
      .eq("org_id", orgId)
      .order("callsign", { ascending: true }),
  ]);
  return {
    incidents: (inc.data ?? []) as Incident[],
    units: (un.data ?? []) as Unit[],
  };
}

export async function getIncidentWithAssignments(incidentId: string): Promise<{
  incident: Incident | null;
  assignments: IncidentAssignment[];
}> {
  const supabase = await createSSRClient();
  const [i, a] = await Promise.all([
    supabase.from("incidents").select("*").eq("id", incidentId).maybeSingle(),
    supabase.from("incident_assignments_v").select("*")
      .eq("incident_id", incidentId)
      .order("created_at", { ascending: true }),
  ]);
  return {
    incident: (i.data ?? null) as Incident | null,
    assignments: (a.data ?? []) as IncidentAssignment[],
  };
}

export async function getUnitsForOrg(orgId: string): Promise<Unit[]> {
  const supabase = await createSSRClient();
  const { data } = await supabase.from("units").select("*").eq("org_id", orgId).order("callsign");
  return (data ?? []) as Unit[];
}

export async function getMyActiveAssignment(): Promise<{
  assignment: IncidentAssignment | null;
  incident: Incident | null;
  unit: Unit | null;
}> {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { assignment: null, incident: null, unit: null };

  const { data: unit } = await supabase.from("units").select("*")
    .eq("responder_id", user.id)
    .in("status", ["assigned","en_route","on_scene"])
    .maybeSingle();

  if (!unit) return { assignment: null, incident: null, unit: null };

  const { data: assignment } = await supabase.from("incident_assignments_v").select("*")
    .eq("id", (unit as Unit).active_assignment_id ?? "")
    .maybeSingle();
  const { data: incident } = await supabase.from("incidents").select("*")
    .eq("id", (assignment as IncidentAssignment | null)?.incident_id ?? "")
    .maybeSingle();

  return {
    assignment: assignment as IncidentAssignment | null,
    incident: incident as Incident | null,
    unit: unit as Unit,
  };
}

export async function getCallerOrgId(): Promise<string | null> {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("org_roles").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

export type { Incident, Unit, IncidentAssignment, UnitLocation };
