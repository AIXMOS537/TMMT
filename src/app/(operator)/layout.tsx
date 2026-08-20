import PortalChrome from "@/components/PortalChrome";
import BrandScope from "@/components/brand/BrandScope";

export const metadata = {
  title: "Operator — TMMT",
};

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <BrandScope>
      <PortalChrome title="Operator" subtitle="Approved instructions from leadership">
        {children}
      </PortalChrome>
    </BrandScope>
  );
}
