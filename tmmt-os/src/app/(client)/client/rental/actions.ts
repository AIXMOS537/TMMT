"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { requireEntitlement } from "@/lib/auth-portals";

export async function acknowledgeAlert(alertId: string) {
  await requireEntitlement("rental_hub", "/client/dashboard");
  const me = await getCurrentUser();
  if (!me?.email) throw new Error("Not signed in");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("client_alerts")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", alertId);

  if (error) throw new Error(error.message);
  revalidatePath("/client/rental");
}
