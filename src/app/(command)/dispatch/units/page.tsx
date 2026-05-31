import { getCallerOrgId, getUnitsForOrg } from "@/lib/dispatch-queries";
import { UnitsClient } from "./UnitsClient";

export default async function UnitsPage() {
  const orgId = await getCallerOrgId();
  if (!orgId) return <p className="p-6">No tenant.</p>;
  const units = await getUnitsForOrg(orgId);
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Units</h1>
      <UnitsClient units={units} />
    </div>
  );
}
