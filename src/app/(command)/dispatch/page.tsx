import Link from "next/link";
import { getDispatchCockpitData, getCallerOrgId } from "@/lib/dispatch-queries";
import { CockpitClient } from "./_components/CockpitClient";

export default async function DispatchPage() {
  const orgId = await getCallerOrgId();
  if (!orgId) {
    return (
      <div className="p-6">
        <p>No dispatch tenant configured for your account.</p>
        <Link href="/" className="text-blue-600 underline">back home</Link>
      </div>
    );
  }
  const { incidents, units } = await getDispatchCockpitData(orgId);
  return <CockpitClient orgId={orgId} initialIncidents={incidents} initialUnits={units} />;
}
