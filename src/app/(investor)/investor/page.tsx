import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { getTierForUser } from "@/lib/auth-roles";
import { getInvestorUpdates } from "@/lib/queries";
import { Card, StatCard } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { Bell, FileText } from "lucide-react";

export default async function InvestorPortalPage() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (getTierForUser(user) !== "investor") redirect("/");

  const updates = await getInvestorUpdates();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Read-only investor view. Contact TMMT for detailed reports or documents.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Published updates"
          value={updates.length}
          icon={<Bell size={20} />}
          trend="Staff-published announcements"
        />
        <StatCard
          label="Access level"
          value="Investor"
          icon={<FileText size={20} />}
          trend="Operational case data is hidden"
        />
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Updates</h2>
        {updates.length === 0 ? (
          <Card className="p-8 text-center text-sm text-gray-600 dark:text-slate-400">
            No updates yet. Your account may need to be linked to an investor profile in Supabase.
          </Card>
        ) : (
          <ul className="space-y-3">
            {updates.map((u) => (
              <li key={String(u.id)}>
                <Card className="p-5">
                  <p className="font-medium text-gray-900 dark:text-white">{u.title as string}</p>
                  {u.body ? (
                    <p className="text-sm text-gray-600 dark:text-slate-400 mt-2 whitespace-pre-wrap">
                      {u.body as string}
                    </p>
                  ) : null}
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">
                    {formatDateTime(u.published_at as string)}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
