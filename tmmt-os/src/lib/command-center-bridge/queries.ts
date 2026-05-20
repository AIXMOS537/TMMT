import { createCommandCenterClient, isCommandCenterBridgeConfigured } from "./client";

export type CommandCenterContract = {
  id: string;
  contract_id: number | null;
  active_customer: string | null;
  contract_status: string | null;
  start_date: string | null;
  end_date: string | null;
  total_contract_amount: number | null;
};

export type CommandCenterBackgroundCheck = {
  id: string;
  customer_name: string | null;
  email: string | null;
  background_check_status: string | null;
  created_at: string | null;
};

export type CommandCenterBridgeSnapshot = {
  configured: boolean;
  contracts: CommandCenterContract[];
  backgroundChecks: CommandCenterBackgroundCheck[];
};

export async function fetchCommandCenterBridgeByEmail(
  email: string
): Promise<CommandCenterBridgeSnapshot> {
  const normalized = email.trim().toLowerCase();
  if (!isCommandCenterBridgeConfigured()) {
    return { configured: false, contracts: [], backgroundChecks: [] };
  }

  const db = createCommandCenterClient();
  if (!db) {
    return { configured: false, contracts: [], backgroundChecks: [] };
  }

  const [{ data: contracts }, { data: bg }] = await Promise.all([
    db
      .from("contracts")
      .select("id, contract_id, active_customer, contract_status, start_date, end_date, total_contract_amount")
      .ilike("active_customer", `%${normalized}%`)
      .order("start_date", { ascending: false })
      .limit(20),
    db
      .from("background_checks")
      .select("id, customer_name, email, background_check_status, created_at")
      .ilike("email", normalized)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return {
    configured: true,
    contracts: (contracts ?? []) as CommandCenterContract[],
    backgroundChecks: (bg ?? []) as CommandCenterBackgroundCheck[],
  };
}
