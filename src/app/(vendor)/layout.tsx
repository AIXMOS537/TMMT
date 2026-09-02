import PortalChrome from "@/components/PortalChrome";
import BrandScope from "@/components/brand/BrandScope";
import { allowedCommandHubHrefs } from "@/lib/command-hub-access";
import { getCommandHubViewer } from "@/lib/command-hub-access-server";

export const metadata = {
  title: "Vendor Portal — TMMT",
  description: "Jobs assigned to your vendor account",
};

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const navHrefs = allowedCommandHubHrefs(await getCommandHubViewer());

  return (
    <BrandScope>
      <PortalChrome
        navHrefs={navHrefs}
        title="Vendor portal"
        subtitle="Accept jobs, update status, upload photos and invoices"
      >
        {children}
      </PortalChrome>
    </BrandScope>
  );
}
