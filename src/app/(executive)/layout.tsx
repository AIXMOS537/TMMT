import PortalChrome from "@/components/PortalChrome";
import BrandScope from "@/components/brand/BrandScope";
import { allowedCommandHubHrefs } from "@/lib/command-hub-access";
import { getCommandHubViewer } from "@/lib/command-hub-access-server";

export const metadata = {
  title: "Executive VA — TMMT",
};

export default async function ExecutiveLayout({ children }: { children: React.ReactNode }) {
  const navHrefs = allowedCommandHubHrefs(await getCommandHubViewer());

  return (
    <BrandScope>
      <PortalChrome
        navHrefs={navHrefs}
        title="Executive VA"
        subtitle="Owner commands · relay to operators (AI-reviewed)"
      >
        {children}
      </PortalChrome>
    </BrandScope>
  );
}
