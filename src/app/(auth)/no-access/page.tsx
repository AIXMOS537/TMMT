import type { Metadata } from "next";
import Link from "next/link";
import { createSSRClient } from "@/lib/supabase-server";
import { getTierForUser, homePathForTier } from "@/lib/auth-roles";
import { signOut } from "@/app/(admin)/actions";
import BrandLogo from "@/components/brand/BrandLogo";
import { getRequestBrand } from "@/lib/platform/request-brand";

export const metadata: Metadata = {
  title: "No access",
  robots: { index: false, follow: false },
};

// Reads the session cookie on every request; never cache a "who are you" page.
export const dynamic = "force-dynamic";

/**
 * The landing for a signed-in account that the edge refuses.
 *
 * Two callers, both in src/middleware.ts:
 *
 *   - homePathForTier("none"): an account with no recognised app_metadata.role.
 *     It is entitled to the public pages, /clock and /pocket, and nothing else.
 *     Before this page existed its home was "/", which is the rentals desk, so
 *     the edge could not deny the desk without redirecting "/" to "/" forever.
 *   - ?hub=owner: a signed-in non-owner on the owner-hub host. That used to go
 *     to /login?hub=owner, which (still signed in, still on /login) redirected
 *     to itself.
 *
 * The middleware treats /no-access as PUBLIC so that a stale or half-expired
 * session can always reach it. That is why the no-user branch below exists:
 * an anonymous visitor is shown the way to /login rather than being bounced.
 *
 * Nothing here grants anything. The only action is sign-out.
 */
export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ hub?: string }>;
}) {
  const [{ hub }, brand, supabase] = await Promise.all([
    searchParams,
    getRequestBrand(),
    createSSRClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ownerHubVariant = hub === "owner";
  const tier = getTierForUser(user);
  const email = user?.email ?? null;

  let heading: string;
  let body: React.ReactNode;

  if (!user) {
    heading = "You are not signed in";
    body = (
      <p>
        Your session has ended. Sign in again to continue.
      </p>
    );
  } else if (ownerHubVariant) {
    heading = "The owner hub is owner-only";
    body = (
      <>
        <p>
          {email ? (
            <>
              <span className="font-medium text-gray-900 dark:text-white">{email}</span> is signed
              in, but it is not an owner account.
            </>
          ) : (
            "This account is signed in, but it is not an owner account."
          )}{" "}
          Nothing on this host is available to it.
        </p>
        {tier !== "none" ? (
          <p>
            Your own workspace is on the {brand.displayName} app, not the owner hub. Sign out here,
            then sign in there.
          </p>
        ) : null}
      </>
    );
  } else {
    heading = "This account has no access yet";
    body = (
      <>
        <p>
          {email ? (
            <>
              <span className="font-medium text-gray-900 dark:text-white">{email}</span> is signed
              in, but no role has been assigned to it.
            </>
          ) : (
            "This account is signed in, but no role has been assigned to it."
          )}{" "}
          Until one is, it can reach only the{" "}
          <Link href="/clock" className="underline underline-offset-2">
            time clock
          </Link>{" "}
          and{" "}
          <Link href="/pocket" className="underline underline-offset-2">
            Pocket
          </Link>
          .
        </p>
        <p>
          Ask the person who set up your {brand.displayName} account to assign your role. Once
          they have, sign out and sign back in — the new role is read at sign-in.
        </p>
      </>
    );
  }

  // The (auth) layout supplies BrandScope and the centred shell.
  return (
    <div className="w-full max-w-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200 dark:border-slate-700 p-8">
        <div className="mb-6 text-center space-y-2">
          <div className="flex justify-center mb-4">
            <BrandLogo brand={brand} size={36} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Access
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{heading}</h1>
        </div>

        <div className="space-y-3 text-sm text-gray-600 dark:text-slate-400">{body}</div>

        <div className="mt-8 space-y-3">
          {user ? (
            <form action={signOut}>
              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700"
            >
              Go to sign in
            </Link>
          )}
          {user && !ownerHubVariant && tier !== "none" ? (
            // Someone with a real role who landed here by typing the URL.
            <Link
              href={homePathForTier(tier)}
              className="block text-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Back to your workspace
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
