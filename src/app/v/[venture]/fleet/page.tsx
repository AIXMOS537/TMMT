import { notFound } from "next/navigation";
import Link from "next/link";
import { createSSRClient } from "@/lib/supabase-server";
import { getVentureBySlug } from "@/lib/ventures/registry";
import { listVentureFleet, summariseFleet } from "@/lib/ventures/fleet";
import { ventureHref } from "@/lib/ventures/paths";

export const dynamic = "force-dynamic";

function describe(r: { vehicle_name: string | null; vehicle_make: string | null; vehicle_model: string | null; year: number | null }) {
  const built = [r.year, r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ");
  return r.vehicle_name?.trim() || built || "Unnamed vehicle";
}

export default async function VentureFleetPage({
  params,
}: {
  params: Promise<{ venture: string }>;
}) {
  const { venture: slug } = await params;
  const venture = await getVentureBySlug(slug);
  if (!venture) notFound();

  // RLS-enforced: this reads as the signed-in staff user, not as service-role.
  const supabase = await createSSRClient();
  const { rows, failed } = await listVentureFleet(supabase);
  const byStatus = summariseFleet(rows);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href={ventureHref(slug)} className="text-sm text-muted-foreground hover:underline">
          ← {venture.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Fleet</h1>
      </header>

      {failed ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          The fleet could not be read. This is not an empty fleet — see <code>venture-registry</code> on{" "}
          <code>/api/health</code>.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border px-4 py-3 text-sm text-muted-foreground">
          No vehicles in this venture yet.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {byStatus.map(({ status, count }) => (
              <span key={status} className="rounded-full border px-3 py-1 text-sm">
                {status} <span className="tabular-nums font-medium">{count}</span>
              </span>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Vehicles in {venture.name}, {rows.length} in total
              </caption>
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Vehicle</th>
                  <th scope="col" className="px-4 py-2 font-medium">Plate</th>
                  <th scope="col" className="px-4 py-2 font-medium">Colour</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{describe(r)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.license_plate ?? "—"}</td>
                    <td className="px-4 py-2">{r.color ?? "—"}</td>
                    <td className="px-4 py-2">{r.vehicle_status ?? "Unspecified"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
