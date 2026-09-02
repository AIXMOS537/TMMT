import PortalChrome from "@/components/PortalChrome";
import BrandScope from "@/components/brand/BrandScope";
import { allowedCommandHubHrefs } from "@/lib/command-hub-access";
import { getCommandHubViewer } from "@/lib/command-hub-access-server";

export const metadata = {
  title: "Operator — TMMT",
};

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const navHrefs = allowedCommandHubHrefs(await getCommandHubViewer());

  return (
    <BrandScope>
      <PortalChrome
        navHrefs={navHrefs}
        title="Operator"
        subtitle="Approved instructions from leadership"
      >
        {children}
      </PortalChrome>
    </BrandScope>
  );
}
