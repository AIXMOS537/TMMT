import { notFound, redirect } from "next/navigation";
import Sidebar from "@/components/rentals-admin/Sidebar";
import { getUserAccess, hasOrgModuleAccess } from "@/lib/access/resolve";
import { buildRentalsNavGroups } from "@/lib/access/rentals-nav";
import { ventureHref } from "@/lib/rentals/venture-paths";
import { requireRole } from "@/lib/auth";
import { getVentureBySlug } from "@/lib/rentals/ventures";

export default async function VentureLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venture: string }>;
}) {
  await requireRole(["admin", "internal_team"]);
  const access = await getUserAccess();
  if (access && !hasOrgModuleAccess(access, "rentals_app")) {
    redirect("/internal/dashboard?error=module");
  }

  const { venture: slug } = await params;
  const venture = await getVentureBySlug(slug);
  if (!venture || venture.status !== "active") notFound();

  const base = ventureHref(slug, "/");
  const navGroups = buildRentalsNavGroups(base, access);

  return (
    <>
      <Sidebar
        ventureSlug={slug}
        ventureName={venture.name}
        ventureColor={venture.color}
        navGroups={navGroups}
      />
      <main className="lg:pl-64 min-h-screen">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </>
  );
}
