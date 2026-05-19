import PortalChrome from "@/components/PortalChrome";

export const metadata = {
  title: "Command Center — TMMT",
  description: "Private owner hub — ops navigation, fleet, leads, and command desk",
};

export default function CommandLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalChrome
      title="Command center"
      subtitle="Owner hub on .net — ops, fleet, pipeline, and executive command"
    >
      {children}
    </PortalChrome>
  );
}
