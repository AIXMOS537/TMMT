import PortalChrome from "@/components/PortalChrome";
import BrandScope from "@/components/brand/BrandScope";

export const metadata = {
  title: "Investor Portal — TMMT",
  description: "Investor-safe updates and announcements",
};

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return (
    <BrandScope>
      <PortalChrome
        title="Investor portal"
        subtitle="Performance updates and announcements — no internal operations data"
      >
        {children}
      </PortalChrome>
    </BrandScope>
  );
}
