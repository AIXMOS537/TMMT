import { PortalShell } from "@/components/portal-shell";
import { requireRole } from "@/lib/auth";

export default async function InvestorLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole(["investor", "admin"]);
  return (
    <PortalShell
      brand="TMMT OS"
      links={[
        { href: "/investor/dashboard", label: "Dashboard" },
        { href: "/investor/contact", label: "Request update" },
        { href: "/investor/ledger", label: "Ledger" },
      ]}
      user={me}
    >
      {children}
    </PortalShell>
  );
}
