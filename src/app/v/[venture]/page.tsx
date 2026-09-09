import { notFound } from "next/navigation";
import { getVentureBySlug } from "@/lib/ventures/registry";
import { getVentureSummary } from "@/lib/ventures/summary";

export const dynamic = "force-dynamic";

/**
 * A venture's overview. Server-rendered on purpose: the counts come from a
 * service-role client, which must never be reachable from a client component.
 * (The tmmt-os original was "use client" and called its data layer from the
 * browser.)
 */
export default async function VentureOverviewPage({
  params,
}: {
  params: Promise<{ venture: string }>;
}) {
  const { venture: slug } = await params;
  const venture = await getVentureBySlug(slug);
  if (!venture) notFound();

  const summary = await getVentureSummary(venture.id);
  const unavailable = summary.filter(s => s.count === null).length;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          {venture.color ? (
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: venture.color }}
            />
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">{venture.name}</h1>
        </div>
        {venture.description ? (
          <p className="text-sm text-muted-foreground">{venture.description}</p>
        ) : null}
      </header>

      {unavailable > 0 ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {unavailable} {unavailable === 1 ? "figure is" : "figures are"} unavailable right now — shown
          as “—”, not as zero. See <code>venture-registry</code> on <code>/api/health</code>.
        </p>
      ) : null}

      <section
        aria-label="Venture totals"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      >
        {summary.map(({ table, label, count }) => (
          <div key={table} className="rounded-lg border p-4">
            <div className="text-2xl font-semibold tabular-nums">
              {count === null ? "—" : count.toLocaleString()}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </section>

      <p className="text-xs text-muted-foreground">
        Totals are whole-table counts. No operational table carries a venture column yet, so every row
        belongs to this venture until <code>venture_id</code> is added and backfilled.
      </p>
    </div>
  );
}
