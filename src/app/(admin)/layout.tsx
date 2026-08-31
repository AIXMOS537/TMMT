import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import BrandScope from "@/components/brand/BrandScope";
import OfflineSyncBar from "@/components/OfflineSyncBar";
import { createSSRClient } from "@/lib/supabase-server";
import { isStaffUser, getTierForUser, homePathForTier } from "@/lib/auth-roles";

/**
 * The gate for all 31 admin screens.
 *
 * It has to live here rather than in middleware. (admin) is a route group, so
 * it never appears in a URL: these pages are served at bare paths — /payments,
 * /customers, /background-checks, /insurance, /contracts — that share no
 * prefix. pathAllowedForTier could only cover them by listing all 31 by hand,
 * which would drift the first time somebody adds a screen. The layout knows
 * exactly which pages it wraps, and cannot fall out of step with them.
 *
 * Until now nothing checked at all. The tier switch denied only /money, so any
 * signed-in account reached payments, customer records, background checks and
 * insurance, with row-level security as the only thing holding.
 *
 * Verified against the live database before turning this on: every account has
 * app_metadata.role set, both owner accounts resolve to the owner tier, and the
 * one customer account resolves to "none". So this locks out exactly the
 * account that should never have been here, and no one else.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isStaffUser(user)) redirect(homePathForTier(getTierForUser(user)));

  return (
    <BrandScope>
      <Sidebar />
      <main className="lg:pl-64 min-h-screen">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <OfflineSyncBar />
          {children}
        </div>
      </main>
    </BrandScope>
  );
}
