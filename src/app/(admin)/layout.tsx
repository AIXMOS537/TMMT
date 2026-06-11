import Sidebar from "@/components/Sidebar";
import { createSSRClient } from "@/lib/supabase-server";
import { isStaffUser } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

/**
 * Defense in depth. Middleware is the primary auth gate but its route matcher
 * is a fragile negative-lookahead; if it ever regresses (e.g. a contributor
 * adds an excluded extension or a routing edge case) the admin pages would
 * render unauthenticated. This server-side check ensures the admin shell
 * itself enforces auth + admin tier before rendering any child route.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSSRClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isStaffUser(user)) redirect("/");

  return (
    <>
      <Sidebar />
      <main className="lg:pl-64 min-h-screen">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </>
  );
}
