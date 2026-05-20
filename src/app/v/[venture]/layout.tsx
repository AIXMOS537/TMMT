import { notFound, redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getVentureBySlug } from "@/lib/ventures";
import { createSSRClient } from "@/lib/supabase-server";
import { loadOrgLicenseForUser } from "@/lib/load-org-license";
import { hasOrgModule } from "@/lib/org-license";
import { ventureHref } from "@/lib/venture-paths";

export default async function VentureLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ venture: string }>;
}) {
  const { venture: slug } = await params;
  const venture = await getVentureBySlug(slug);
  if (!venture || venture.status !== "active") notFound();

  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const license = user ? await loadOrgLicenseForUser(supabase, user.id) : null;
  if (license && !hasOrgModule(license, "rentals_app")) {
    redirect("/?error=module");
  }

  return (
    <>
      <Sidebar
        ventureSlug={slug}
        ventureName={venture.name}
        ventureColor={venture.color}
        orgLicense={license}
      />
      <main className="lg:pl-64 min-h-screen">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </>
  );
}
