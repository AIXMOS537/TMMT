import PortalChrome from "@/components/PortalChrome";

export const metadata = {
  title: "Command Center — TMMT",
  description: "Owner command desk with AI assistant and fact-check",
};

export default function CommandLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalChrome
      title="Command center"
      subtitle="Speak → AI assistant → fact-check → dispatch to executive VAs"
    >
      {children}
    </PortalChrome>
  );
}
