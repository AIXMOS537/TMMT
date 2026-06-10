import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { isStaffUser } from "@/lib/auth-roles";

export const metadata = {
  title: "Dispatch — TMMT",
  description: "Rescue dispatch cockpit",
};

export default async function DispatchLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!isStaffUser(user)) {
    const { data } = await supabase.from("org_roles").select("role").eq("user_id", user.id).limit(1).maybeSingle();
    if (!data) redirect("/");
  }

  return <div className="h-[calc(100vh-4rem)]">{children}</div>;
}
