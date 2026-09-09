"use server";

import { createSSRClient } from "@/lib/supabase-server";
import { tryCreateServiceRoleClient } from "@/lib/supabase-service";

/**
 * The signed-in user's own funding application, if they have one.
 *
 * The cube only ever loaded an application when `?applicationId=` was in the
 * URL — that is, when someone arrived through a GHL deep link. A customer who
 * simply signed in and opened /learn got `createInitialState()` instead: the
 * demo persona "Jordan Rivera", jordan@example.com, kept in localStorage. Their
 * real application existed; nothing looked for it.
 *
 * Reads on the service role because program_applications is not granted to the
 * applicant, and matches on their session email — the same rule
 * authorizeApplicationAccess uses to decide whether someone owns an
 * application. It returns an id and nothing else; every read of the application
 * itself still goes through that gate.
 */
export async function findMyApplicationId(): Promise<string | null> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.trim();
  if (!email) return null;

  const service = tryCreateServiceRoleClient();
  if (!service) return null;

  // ilike is case-insensitive, which is what we want for an email — but it also
  // treats % and _ as wildcards, and an address may legitimately contain them.
  const pattern = email.replace(/([\\%_])/g, "\\$1");

  const { data, error } = await service
    .from("program_applications")
    .select("id")
    .ilike("email", pattern)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[findMyApplicationId]", error.message);
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}
