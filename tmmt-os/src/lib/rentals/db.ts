import { createCommandCenterClient, isCommandCenterBridgeConfigured } from "@/lib/command-center-bridge/client";

export function isRentalsDbConfigured(): boolean {
  return isCommandCenterBridgeConfigured();
}

export function getRentalsDb() {
  const db = createCommandCenterClient();
  if (!db) {
    throw new Error(
      "Command Center Supabase is not configured. Set COMMAND_CENTER_SUPABASE_URL and COMMAND_CENTER_SUPABASE_SERVICE_KEY."
    );
  }
  return db;
}
