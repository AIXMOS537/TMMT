import { getCallerOrgId } from "@/lib/dispatch-queries";
import { NewIncidentForm } from "./NewIncidentForm";

export default async function NewIncidentPage() {
  const orgId = await getCallerOrgId();
  if (!orgId) return <p className="p-6">No tenant.</p>;
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">New incident</h1>
      <NewIncidentForm orgId={orgId} />
    </div>
  );
}
