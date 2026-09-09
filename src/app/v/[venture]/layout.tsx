import { notFound, redirect } from "next/navigation";
import BrandScope from "@/components/brand/BrandScope";
import { createSSRClient } from "@/lib/supabase-server";
import { getTierForUser, homePathForTier, isStaffUser } from "@/lib/auth-roles";
import { getVentureBySlug } from "@/lib/ventures/registry";

/**
 * The gate for every venture-scoped screen.
 *
 * The version in tmmt-os gated through its own access layer — requireRole,
 * getUserAccess, hasOrgModuleAccess. That layer is not ported: this app already
 * has a tested one, with org roles and RLS policies behind it, and two auth
 * systems in one codebase is how a gap opens. So venture scoping wins on
 * structure, and the app's own auth wins on identity — the same check the 31
 * admin screens use, applied here.
 *
 * A slug that names no venture, or one that is paused or archived, is a 404
 * rather than a redirect: the venture may exist and simply not be yours to see,
 * and a redirect would confirm which it was.
 */
export default async function VentureLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venture: string }>;
}) {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isStaffUser(user)) redirect(homePathForTier(getTierForUser(user)));

  const { venture: slug } = await params;
  const venture = await getVentureBySlug(slug);
  if (!venture || venture.status !== "active") notFound();

  return (
    <BrandScope>
      <main className="min-h-screen">
        <div className="mx-auto max-w-7xl p-6 lg:p-8">{children}</div>
      </main>
    </BrandScope>
  );
}
