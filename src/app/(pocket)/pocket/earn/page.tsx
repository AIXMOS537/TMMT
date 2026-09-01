import Link from "next/link";
import { headers } from "next/headers";
import { DollarSign } from "lucide-react";
import { createSSRClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { getOrCreateReferralCode, getReferralSummary, REFERRAL_RATE } from "@/lib/referrals";
import { Card } from "@/components/ui";
import CopyLink from "@/components/pocket/CopyLink";

export const metadata = { title: "Earn · AIXMOS Pocket" };

export default async function EarnPage() {
  let email: string | null = null;
  let userId: string | null = null;
  try {
    const supabase = await createSSRClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
    userId = user?.id ?? null;
  } catch {
    email = null;
  }

  if (!email) {
    return (
      <div>
        <Link href="/pocket" className="text-sm text-blue-600 dark:text-blue-400">← Pocket</Link>
        <p className="mt-4 text-sm text-gray-600 dark:text-slate-300">
          Activate your membership to get your referral link.
        </p>
        <Link
          href="/pocket"
          className="mt-4 inline-flex rounded-lg bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Activate membership
        </Link>
      </div>
    );
  }

  let code = "";
  let collectedTotal = 0;
  let collectedCount = 0;
  // Distinguish "you have earned nothing yet" from "we could not find out".
  // Showing $0.00 to an affiliate when the lookup failed is not a neutral
  // default — it is a specific and wrong claim about their money.
  let earningsKnown = false;
  try {
    const service = createServiceRoleClient();
    code = await getOrCreateReferralCode(service, { email, userId });
    const summary = await getReferralSummary(service, code);
    collectedTotal = summary.collectedTotal;
    collectedCount = summary.collectedCount;
    earningsKnown = true;
  } catch (err) {
    console.error("[pocket/earn]", err instanceof Error ? err.message : err);
    code = "";
  }

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "allinonemanagementsolutions.com";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const link = code ? `${proto}://${host}/?ref=${code}` : "";

  return (
    <div>
      <header className="mb-5">
        <Link href="/pocket" className="text-sm text-blue-600 dark:text-blue-400">← Pocket</Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <DollarSign className="h-6 w-6" /> Earn
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Share your link. Earn commission on every sale that&apos;s collected — real
          money on real sales.
        </p>
      </header>

      <Card className="p-5 mb-4">
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Collected earnings</p>
        <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">
          {earningsKnown ? `$${collectedTotal.toFixed(2)}` : "—"}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          {earningsKnown ? (
            <>
              {collectedCount} collected {collectedCount === 1 ? "sale" : "sales"} ·{" "}
              {Math.round(REFERRAL_RATE * 100)}% per collected sale
            </>
          ) : (
            <>
              We couldn&apos;t load your earnings just now — this is not a zero.
              Try again shortly, or contact us if it persists.
            </>
          )}
        </p>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-medium text-gray-900 dark:text-white">Your referral link</p>
        {link ? (
          <CopyLink link={link} />
        ) : (
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            Your link will appear here once your account is ready.
          </p>
        )}
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
          You earn a commission <strong>only on sales that are actually collected and
          cleared.</strong> There is no guaranteed or passive income, and you are not
          paid for sign-ups or referrals that don&apos;t result in a collected sale.
          This is a simple, single-tier referral reward — not a multi-level program.
        </p>
      </Card>
    </div>
  );
}
