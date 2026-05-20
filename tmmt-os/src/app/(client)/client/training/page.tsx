import Link from "next/link";
import { requireEntitlement } from "@/lib/auth-portals";
import { getCurrentUser } from "@/lib/auth";
import { getJourneyHub } from "@/lib/client-journey/queries";
import { PageHeader } from "@/components/page-header";
import { TrainingModuleCard } from "@/components/client-journey/training-module-card";

export const dynamic = "force-dynamic";

export default async function ClientTrainingPage() {
  await requireEntitlement("training_credit_rebuild", "/client/dashboard");
  const me = await getCurrentUser();
  if (!me?.email) {
    return <p className="text-sm text-muted-foreground">Profile email required.</p>;
  }

  const hub = await getJourneyHub(me.email, me.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Credit rebuild training"
        description={`Complete all core modules to unlock lease-to-own (${hub.training.coreDone}/${hub.training.coreTotal} done).`}
        action={
          <Link href="/client/credit" className="text-sm font-medium text-primary hover:underline">
            ← Credit education
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {hub.training.modules.map((m) => (
          <TrainingModuleCard
            key={m.id}
            moduleId={m.id}
            title={m.title}
            summary={m.summary}
            percent={m.percent_complete}
            completed={Boolean(m.completed_at)}
          />
        ))}
      </div>

      {hub.training.modules.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Training modules will appear after migration 0014 is applied in Supabase.
        </p>
      )}
    </div>
  );
}
