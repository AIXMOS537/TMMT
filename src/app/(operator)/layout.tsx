import PortalChrome from "@/components/PortalChrome";

export const metadata = {
  title: "Operator — TMMT",
};

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalChrome title="Operator" subtitle="Approved instructions from leadership">
      {children}
    </PortalChrome>
  );
}
