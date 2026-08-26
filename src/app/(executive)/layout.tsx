import PortalChrome from "@/components/PortalChrome";
import BrandScope from "@/components/brand/BrandScope";

export const metadata = {
  title: "Executive VA — TMMT",
};

export default function ExecutiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <BrandScope>
      <PortalChrome
        title="Executive VA"
        subtitle="Owner commands · relay to operators (AI-reviewed)"
      >
        {children}
      </PortalChrome>
    </BrandScope>
  );
}
