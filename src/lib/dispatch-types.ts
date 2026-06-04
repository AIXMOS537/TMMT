export type Severity = 1 | 2 | 3;

export type IncidentStatus =
  | "received" | "assigning" | "assigned" | "en_route"
  | "on_scene" | "cleared" | "closed" | "cancelled";

export type UnitStatus =
  | "off_duty" | "available" | "assigned"
  | "en_route" | "on_scene" | "out_of_service";

export type AssignmentStatus = "pending" | "locked" | "cancelled" | "completed";

export type VehicleClass =
  | "sport_bike" | "sport_car" | "sport_suv"
  | "van" | "truck" | "helicopter" | "foot" | "other";

export interface Incident {
  id: string;
  org_id: string;
  ref_code: string | null;
  reported_at: string;
  reporter_name: string | null;
  reporter_phone: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_text: string | null;
  description: string | null;
  severity: Severity | null;
  required_capabilities: string[];
  required_class: VehicleClass | null;
  status: IncidentStatus;
  created_by: string | null;
  closed_at: string | null;
}

export interface Unit {
  id: string;
  org_id: string;
  fleet_id: string | null;
  responder_id: string | null;
  callsign: string;
  status: UnitStatus;
  current_lat: number | null;
  current_lng: number | null;
  last_ping_at: string | null;
  active_assignment_id: string | null;
}

export interface UnitLocation {
  id: number;
  org_id: string;
  unit_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed_mph: number | null;
  recorded_at: string;
}

export interface IncidentAssignment {
  id: string;
  org_id: string;
  incident_id: string;
  unit_id: string;
  assigned_by_kind: "system" | "user";
  assigned_by: string | null;
  override_weight: number;
  reasoning_json: AssignmentReasoning;
  status: AssignmentStatus;
  created_at: string;
  locked_at: string | null;
  effective_status?: AssignmentStatus;
}

export interface AssignmentReasoning {
  captain_used: boolean;
  captain_skipped?: boolean;
  candidates: Candidate[];
  pick_index: number;
  captain_text?: string;
  override_reason?: string;
}

export interface Candidate {
  unit_id: string;
  callsign: string;
  distance_km: number;
  capability_match_score: number;
  eta_seconds: number;
}
