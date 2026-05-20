import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { getCooBriefing, listRecentCooBriefings } from "@/lib/coo-briefing/queries";
import { CooBriefingPanel } from "@/components/coo-briefing/briefing-panel";

export const dynamic = "force-dynamic";

export default async function InternalBriefingPage() {
  await requireRole(["admin", "internal_team"]);
  const today = new Date().toISOString().slice(0, 10);
  const [daily, weekly, recent] = await Promise.all([
    getCooBriefing(today, "daily"),
    getCooBriefing(today, "weekly"),
    listRecentCooBriefings(10),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="COO briefing"
        description="Daily 9AM standup to founder and weekly ops summary — VA Elevation framework."
      />
      <CooBriefingPanel today={today} daily={daily} weekly={weekly} />
      {recent.length > 0 && (
        <section className="surface-card space-y-3 p-5">
          <h2 className="text-lg font-medium">Recent briefings</h2>
          <ul className="divide-y text-sm">
            {recent.map((b) => (
              <li key={b.id} className="flex justify-between gap-4 py-2">
                <span>
                  {b.briefing_date} · <span className="capitalize">{b.kind}</span>
                </span>
                <span className="text-muted-foreground">
                  {b.kind === "daily"
                    ? (b.pipeline_health?.slice(0, 60) ?? "—")
                    : (b.weekly_summary?.slice(0, 60) ?? "—")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
