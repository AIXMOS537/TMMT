import Link from "next/link";
import { getMyActiveAssignment } from "@/lib/dispatch-queries";
import { StatusTransitionBar } from "../_components/StatusTransitionBar";

export default async function MePage() {
  const { assignment, incident, unit } = await getMyActiveAssignment();
  if (!assignment || !incident || !unit) {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-semibold">No active assignment</h1>
        <p className="mt-2 text-sm text-zinc-500">You&apos;ll see your incident here when dispatched.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md p-6 space-y-3">
      <h1 className="text-xl font-semibold">{incident.ref_code}</h1>
      <p className="text-sm">{incident.location_text}</p>
      <p className="text-xs text-zinc-500">S{incident.severity} · status {incident.status}</p>
      {incident.description && <p className="rounded bg-zinc-50 p-2 text-sm dark:bg-zinc-900">{incident.description}</p>}
      <Link
        href={`https://maps.apple.com/?daddr=${incident.location_lat},${incident.location_lng}`}
        className="block rounded bg-blue-600 px-4 py-2 text-center text-white"
        target="_blank"
      >
        Open in Maps
      </Link>
      <StatusTransitionBar incidentId={incident.id} current={incident.status} onChanged={() => {}} />
    </div>
  );
}
