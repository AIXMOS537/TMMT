import { createSupabaseServiceClient } from "@/lib/supabase/service";

/** Activity log writes from webhooks / agents (no authenticated user context). */
export async function logServiceActivity(args: {
  entity: string;
  entityId: string;
  action: string;
  data?: Record<string, unknown>;
}) {
  const supabase = createSupabaseServiceClient();
  await supabase.from("activity_logs").insert({
    actor_id: null,
    entity: args.entity,
    entity_id: args.entityId,
    action: args.action,
    data: args.data ?? {},
  });
}
