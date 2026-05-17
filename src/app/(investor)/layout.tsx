import PortalChrome from "@/components/PortalChrome";

export const metadata = {
  title: "Investor Portal — TMMT",
  description: "Investor-safe updates and announcements",
};

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalChrome
      title="Investor portal"
      subtitle="Performance updates and announcements — no internal operations data"
    >
      {children}
    </PortalChrome>
  );
}
