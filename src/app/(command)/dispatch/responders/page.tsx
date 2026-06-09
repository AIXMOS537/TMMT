import { getCallerOrgId } from "@/lib/dispatch-queries";
import { createSSRClient } from "@/lib/supabase-server";
import { RespondersClient, type ResponderLinkRow } from "./RespondersClient";

export default async function RespondersPage() {
  const orgId = await getCallerOrgId();
  if (!orgId) return <p className="p-6">No tenant.</p>;
  const supabase = await createSSRClient();
  const { data } = await supabase.from("org_responder_links")
    .select("*, profiles:user_id(full_name, email, telegram_chat_id)")
    .eq("org_id", orgId)
    .order("approved_at", { ascending: false, nullsFirst: true });
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Responder links</h1>
      <RespondersClient orgId={orgId} links={(data ?? []) as ResponderLinkRow[]} />
    </div>
  );
}
