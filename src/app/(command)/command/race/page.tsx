import Link from "next/link";
import { getDashboardData } from "@/lib/queries";
import { buildOwnerRaceData } from "@/lib/race/build-race-data";
import { TrapRaceBoard } from "@/components/race/trap-race-board";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Race Command — Watchtower",
  description: "3D TRAP race board — empire goal, racers, blockers",
};

export default async function RaceCommandPage() {
  const dash = await getDashboardData();
  const race = buildOwnerRaceData(dash);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Race command"
        description="See where you are, where every racer is, and what's blocking the finish line"
      />

      <TrapRaceBoard data={race} />

      <Card className="p-4 border-violet-200 dark:border-violet-800">
        <p className="text-sm text-gray-700 dark:text-slate-300">
          <strong>One move:</strong>{" "}
          <code className="text-violet-600 dark:text-violet-400">x --money</code> on Carry →
          paste GHL checkout URLs →{" "}
          <code className="text-violet-600 dark:text-violet-400">npm run ghl:sync-vercel</code>.
          Full crumbs:{" "}
          <Link href="/command" className="text-blue-600 dark:text-blue-400 hover:underline">
            command hub
          </Link>{" "}
          · config/OWNER-CRUMBS.md
        </p>
      </Card>
    </div>
  );
}
