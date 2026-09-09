import { createSSRClient } from "@/lib/supabase-server";
import { getAppRole, getTierForUser, homePathForTier } from "@/lib/auth-roles";
import { redirect } from "next/navigation";

/**
 * Read-only: what does this app think you are?
 *
 * This exists because the tier rules and the accounts disagree, and there was
 * no way to see it. getTierForUser reads app_metadata.role and falls to "none"
 * on anything it does not recognise — deliberately, since granting on absence
 * was the earlier bug — but if no account carries a role, every signed-in user
 * lands on "none". Whether that is true here cannot be answered from the repo;
 * only a real session can answer it.
 *
 * So: sign in, open this page, read the two lines. It changes nothing, writes
 * nothing, and gates nothing. It is a mirror, and it should be deleted once the
 * roles are set and the middleware is tightened around them.
 */

export const dynamic = "force-dynamic";

const TIER_REACH: Record<string, string> = {
  owner: "Everything.",
  executive: "Only /executive.",
  operator: "Only /operator (and, by a prefix slip, /operators).",
  vendor: "Only /vendor.",
  investor: "Only /investor and /partner.",
  staff: "Everything except /vendor, /investor, /partner, /command, /executive, /operator and /money.",
  none: "Only /clock and /pocket. Everything else redirects to /no-access.",
};

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border-t border-gray-200 dark:border-slate-700 py-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg break-all">{value}</div>
      {note ? (
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">{note}</p>
      ) : null}
    </div>
  );
}

export default async function WhoAmIPage() {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const rawRole = getAppRole(user);
  const tier = getTierForUser(user);
  const roleIsSet = rawRole !== "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Who this app thinks you are</h1>
        <p className="mt-2 text-gray-600 dark:text-slate-400">
          Read-only. Nothing on this page changes any setting.
        </p>

        <div className="mt-8 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 pb-6">
          <Row label="Signed in as" value={user.email ?? "(no email on this account)"} />
          <Row
            label="app_metadata.role"
            value={roleIsSet ? rawRole : "(not set)"}
            note={
              roleIsSet
                ? "This is the value the middleware reads."
                : "This is the value the middleware reads, and it is empty — which is what drops you to the 'none' tier below."
            }
          />
          <Row
            label="Access tier"
            value={tier}
            note={TIER_REACH[tier] ?? "Unrecognised tier."}
          />
          <Row label="Lands on after login" value={homePathForTier(tier)} />
        </div>

        {tier === "owner" ? (
          <p className="mt-6 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 px-4 py-3 text-sm text-green-900 dark:text-green-200">
            Your role is set and you resolve to owner. Tightening the admin rules
            will not lock you out.
          </p>
        ) : (
          <p className="mt-6 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            You are not resolving to owner. If the admin rules were tightened
            right now, this account would lose the admin screens. Set{" "}
            <code>app_metadata.role</code> to <code>admin</code> on this user in
            Supabase first, sign out and back in, then check this page again.
          </p>
        )}
      </div>
    </div>
  );
}
