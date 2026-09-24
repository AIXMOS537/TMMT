import PortalChrome from "@/components/PortalChrome";
import BrandScope from "@/components/brand/BrandScope";
import { getRequestBrand } from "@/lib/platform/request-brand";

export async function generateMetadata() {
  const brand = await getRequestBrand();
  return {
    title: `Command Center \u2014 ${brand.displayName}`,
    description:
      "Private owner hub \u2014 ops navigation, fleet, leads, and command desk",
  };
}

export default function CommandLayout({ children }: { children: React.ReactNode }) {
  return (
    <BrandScope>
      <PortalChrome
        title="Command center"
        subtitle="Ops, fleet, pipeline, and executive command"
      >
        {children}
      </PortalChrome>
    </BrandScope>
  );
}
