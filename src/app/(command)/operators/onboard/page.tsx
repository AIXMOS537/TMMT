import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { isStaffUser } from "@/lib/auth-roles";
import OnboardClient from "./OnboardClient";

export const metadata = { title: "Onboard an operator — TMMT" };

// Owner/staff only, guarded here as well as in middleware. This page creates
// organizations and issues licences; it does not get to rely on path matching.
export default async function OnboardOperatorPage() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isStaffUser(user)) redirect("/");
  return <OnboardClient />;
}
