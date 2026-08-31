import { redirect } from "next/navigation";
import { CubeProgramShell } from "@/components/CubeProgramShell";
import { createSSRClient } from "@/lib/supabase-server";
import { isStaffUser, getTierForUser, homePathForTier } from "@/lib/auth-roles";

export const metadata = {
  title: "AIXMOS Program — TMMT Workforce",
  description: "Staff review queue for credit & funding readiness",
};

/**
 * Staff only — the description above says so, and now the code does too.
 *
 * Same route-group blind spot as (admin): these render at /work/*, which the
 * tier rules never named, so any signed-in account could open the review queue.
 * /work/review shows an applicant's income and requested funding for whatever
 * application id is in the query string.
 */
export default async function ProgramLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isStaffUser(user)) redirect(homePathForTier(getTierForUser(user)));

  return <CubeProgramShell>{children}</CubeProgramShell>;
}
