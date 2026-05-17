import PortalChrome from "@/components/PortalChrome";

export const metadata = {
  title: "Vendor Portal — TMMT",
  description: "Jobs assigned to your vendor account",
};

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalChrome
      title="Vendor portal"
      subtitle="Accept jobs, update status, upload photos and invoices"
    >
      {children}
    </PortalChrome>
  );
}
