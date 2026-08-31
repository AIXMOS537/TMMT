export const DESK_TABLES = [
  "incoming_leads",
  "fleet",
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
  "vendors",
  "cases",
  "tasks",
] as const;

export type DeskTable = (typeof DESK_TABLES)[number];

export function isDeskTable(table: string): table is DeskTable {
  return (DESK_TABLES as readonly string[]).includes(table);
}
