import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { isStaffUser } from "@/lib/auth-roles";
import OperatorsClient from "./OperatorsClient";

export const metadata = { title: "Operators — TMMT" };

// Owner/staff only — guarded server-side regardless of path matching in middleware.
export default async function OperatorsPage() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isStaffUser(user)) redirect("/");
  return <OperatorsClient />;
}
