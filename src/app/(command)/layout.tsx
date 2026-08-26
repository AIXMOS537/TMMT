import PortalChrome from "@/components/PortalChrome";
import BrandScope from "@/components/brand/BrandScope";

export const metadata = {
  title: "Command Center — TMMT",
  description: "Private owner hub — ops navigation, fleet, leads, and command desk",
};

export default function CommandLayout({ children }: { children: React.ReactNode }) {
  return (
    <BrandScope>
      <PortalChrome
        title="Command center"
        subtitle="Owner hub on .net — ops, fleet, pipeline, and executive command"
      >
        {children}
      </PortalChrome>
    </BrandScope>
  );
}
