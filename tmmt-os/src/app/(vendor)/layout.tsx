import { PortalShell } from "@/components/portal-shell";
import { requireRole } from "@/lib/auth";

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole(["vendor", "admin"]);
  return (
    <PortalShell
      brand="TMMT OS"
      links={[
        { href: "/vendor/dashboard", label: "My jobs" },
        { href: "/vendor/ledger", label: "Expenses" },
      ]}
      user={me}
    >
      {children}
    </PortalShell>
  );
}
