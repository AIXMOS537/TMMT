import { PageHeader } from "@/components/page-header";
import { OpsAssistant } from "@/components/ops-assistant";

export const dynamic = "force-dynamic";

export default function OpsAssistantPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Ops command"
        description="Assign staff, vendors, CRM, and billing in one place — type what you want."
      />
      <OpsAssistant />
    </div>
  );
}
