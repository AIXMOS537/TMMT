import { redirect } from "next/navigation";
import { createSSRClient } from "@/lib/supabase-server";
import { getTierForUser } from "@/lib/auth-roles";
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

  // Read through the same request-scoped client the auth check above used.
  // This page previously called getInvestorUpdates() from @/lib/queries, which
  // is built on the *browser* Supabase client — on the server that carries no
  // session cookie, so the query ran anonymously and row-level security
  // returned nothing. Every investor was permanently shown "No updates yet.
  // Your account may need to be linked to an investor profile", regardless of
  // how many updates were published. The gate used the right client; the read
  // did not.
  const { data } = await supabase
    .from("investor_updates")
    .select("*")
    .eq("visible_to_investors", true)
    .order("published_at", { ascending: false })
    .limit(50);
  const updates = data ?? [];

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
