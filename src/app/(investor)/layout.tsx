import PortalChrome from "@/components/PortalChrome";
import BrandScope from "@/components/brand/BrandScope";
import { allowedCommandHubHrefs } from "@/lib/command-hub-access";
import { getCommandHubViewer } from "@/lib/command-hub-access-server";

export const metadata = {
  title: "Investor Portal — TMMT",
  description: "Investor-safe updates and announcements",
};

export default async function InvestorLayout({ children }: { children: React.ReactNode }) {
  const navHrefs = allowedCommandHubHrefs(await getCommandHubViewer());

  return (
    <BrandScope>
      <PortalChrome
        navHrefs={navHrefs}
        title="Investor portal"
        subtitle="Performance updates and announcements — no internal operations data"
      >
        {children}
      </PortalChrome>
    </BrandScope>
  );
}
