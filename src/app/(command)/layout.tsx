import PortalChrome from "@/components/PortalChrome";
import BrandScope from "@/components/brand/BrandScope";
import { allowedCommandHubHrefs } from "@/lib/command-hub-access";
import { getCommandHubViewer } from "@/lib/command-hub-access-server";

export const metadata = {
  title: "Command Center — TMMT",
  description: "Private owner hub — ops navigation, fleet, leads, and command desk",
};

export default async function CommandLayout({ children }: { children: React.ReactNode }) {
  const navHrefs = allowedCommandHubHrefs(await getCommandHubViewer());

  return (
    <BrandScope>
      <PortalChrome
        navHrefs={navHrefs}
        title="Command center"
        subtitle="Owner hub on .net — ops, fleet, pipeline, and executive command"
      >
        {children}
      </PortalChrome>
    </BrandScope>
  );
}
