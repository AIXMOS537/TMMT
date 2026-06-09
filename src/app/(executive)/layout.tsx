import PortalChrome from "@/components/PortalChrome";

export const metadata = {
  title: "Executive VA — TMMT",
};

export default function ExecutiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalChrome
      title="Executive VA"
      subtitle="Owner commands · relay to operators (AI-reviewed)"
    >
      {children}
    </PortalChrome>
  );
}
