"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getRentalsDb, isRentalsDbConfigured } from "./db";
import * as Q from "./queries-server";

const ADMIN_TABLES = new Set([
  "incoming_leads",
  "fleet",
  "partner_fleet_access",
  "active_customers",
  "customer_payments",
  "maintenance_appointments",
  "appointments",
  "background_checks",
  "contracts",
  "do_not_rent_list",
  "expenses",
  "former_customers",
  "fleet_car_inspections",
  "insurance",
  "operation_costs",
  "tickets",
  "shops_mechanics_cleaning",
  "waitlist",
]);

type SaveResult = { success: true } | { success: false; error: string };

export async function rentalsAdminUpsert(
  table: string,
  record: Record<string, unknown>
): Promise<SaveResult> {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) {
    return { success: false, error: "Command Center bridge not configured." };
  }
  if (!ADMIN_TABLES.has(table)) {
    return { success: false, error: "Invalid table." };
  }

  const { error } = await getRentalsDb().from(table).upsert(record);
  if (error) {
    console.error(`[rentals ${table}]`, error.message);
    return { success: false, error: "Failed to save. Please try again." };
  }
  revalidatePath("/v", "layout");
  return { success: true };
}

export async function rentalsGetDashboardData() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return null;
  return Q.getDashboardData();
}

export async function rentalsGetFleet() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getFleet();
}

export async function rentalsGetLeads() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getLeads();
}

export async function rentalsGetBackgroundChecks() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getBackgroundChecks();
}

export async function rentalsGetWaitlist() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getWaitlist();
}

export async function rentalsGetAppointments() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getAppointments();
}

export async function rentalsGetActiveCustomers() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getActiveCustomers();
}

export async function rentalsGetPayments() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getPayments();
}

export async function rentalsGetInsurance() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getInsurance();
}

export async function rentalsGetTickets() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getTickets();
}

export async function rentalsGetExpenses() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getExpenses();
}

export async function rentalsGetInspections() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getInspections();
}

export async function rentalsGetContracts() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getContracts();
}

export async function rentalsGetVendors() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getVendors();
}

export async function rentalsGetOperationCosts() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getOperationCosts();
}

export async function rentalsGetDoNotRent() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getDoNotRent();
}

export async function rentalsGetFormerCustomers() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getFormerCustomers();
}

export async function rentalsGetMaintenance() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return [];
  return Q.getMaintenance();
}

export async function rentalsGetAppointmentStats() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return null;
  return Q.getAppointmentStats();
}

export async function rentalsGetContractStats() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return null;
  return Q.getContractStats();
}

export async function rentalsGetVehicleStats() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return null;
  return Q.getVehicleStats();
}

export async function rentalsGetPaymentStats() {
  await requireRole(["admin", "internal_team"]);
  if (!isRentalsDbConfigured()) return null;
  return Q.getPaymentStats();
}
