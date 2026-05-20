import {
  createCommandCenterClient,
  isCommandCenterBridgeConfigured,
} from "@/lib/command-center-bridge/client";
import type { DealerFleetRow, DealerLeadRow } from "./types";

export function isDealerDataBridgeReady(): boolean {
  return isCommandCenterBridgeConfigured();
}

export async function fetchDealerFleet(limit = 500): Promise<DealerFleetRow[]> {
  const db = createCommandCenterClient();
  if (!db) return [];

  const { data, error } = await db
    .from("fleet")
    .select(
      "id, vehicle_name, vehicle_make, vehicle_model, year, vin_number, license_plate, vehicle_status, retail_status, acquisition_cost, list_price, mileage"
    )
    .order("vehicle_name", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[dealer fleet]", error.message);
    return [];
  }
  return (data ?? []) as DealerFleetRow[];
}

export async function fetchDealerLeads(limit = 500): Promise<DealerLeadRow[]> {
  const db = createCommandCenterClient();
  if (!db) return [];

  const { data, error } = await db
    .from("incoming_leads")
    .select("id, contact_name, email, phone, status, opportunity_name, created_on")
    .order("created_on", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[dealer leads]", error.message);
    return [];
  }
  return (data ?? []) as DealerLeadRow[];
}

export async function upsertDealerFleetRecord(
  record: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createCommandCenterClient();
  if (!db) return { ok: false, error: "Command Center bridge not configured." };

  const { error } = await db.from("fleet").upsert(record);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function upsertDealerLeadRecord(
  record: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createCommandCenterClient();
  if (!db) return { ok: false, error: "Command Center bridge not configured." };

  const { error } = await db.from("incoming_leads").upsert(record);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
