import Link from "next/link";
import { createSSRClient } from "@/lib/supabase-server";
import { Card } from "@/components/ui";
import {
  getEngagement,
  getChangeRequests,
  type ChangeRequest,
  type Engagement,
} from "@/lib/engagement";
import { BuildTrackerView } from "./BuildTrackerView";

export const metadata = {
  title: "Your build",
  description: "Where your system is up to, and what's running.",
};

// Never cache a per-client view — two clients share this route.
export const dynamic = "force-dynamic";

export default async function ClientBuildPage() {
  // The RLS-respecting client. Using the service-role client here would bypass
  // every policy in the staged migration and show one client another's build.
  // engagement-rls.test.ts asserts this file never imports it.
  let engagement: Engagement | null = null;
  let requests: ChangeRequest[] = [];
  let signedIn = false;

  try {
    const supabase = await createSSRClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);

    if (signedIn) {
      engagement = await getEngagement(supabase);
      if (engagement) {
        requests = await getChangeRequests(supabase, engagement.id);
      }
    }
  } catch {
    // Fail closed: show the signed-out state rather than a partial page.
    signedIn = false;
    engagement = null;
    requests = [];
  }

  if (!signedIn) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Your build</h1>
        <Card className="mt-4 p-4">
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Sign in to see where your system is up to.
          </p>
          <Link
            href="/login"
            className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Sign in
          </Link>
        </Card>
      </div>
    );
  }

  if (!engagement) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Your build</h1>
        <Card className="mt-4 p-4">
          <p className="text-sm text-gray-600 dark:text-slate-300">
            There&apos;s no build on your account yet. Once we start one, every step shows up
            here with the date it happened.
          </p>
        </Card>
      </div>
    );
  }

  return <BuildTrackerView engagement={engagement} requests={requests} />;
}
