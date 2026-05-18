import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Upsert ops_locations from an Airtable row (see INTEGRATIONS/AIRTABLE_OPS_LOCATIONS_SCHEMA.md).
 */
export async function upsertOpsLocationFromAirtable(
  fields: Record<string, unknown>
) {
  const slug = String(fields.Slug ?? fields.slug ?? "").trim();
  const name = String(fields.Name ?? fields.name ?? "").trim();
  if (!slug || !name) {
    throw new Error("Airtable row must include Slug and Name");
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("ops_locations")
    .upsert(
      {
        slug,
        name,
        ghl_pipeline_id: (fields["GHL Pipeline ID"] ?? fields.ghl_pipeline_id) as
          | string
          | undefined,
        ghl_pipeline_name: (fields["GHL Pipeline Name"] ?? fields.ghl_pipeline_name) as
          | string
          | undefined,
        clickup_list_id: (fields["ClickUp List ID"] ?? fields.clickup_list_id) as
          | string
          | undefined,
        overseas_assignee_email: (fields["Overseas Assignee Email"] ??
          fields.overseas_assignee_email) as string | undefined,
        courier_prefs:
          (fields["Courier Prefs"] as Record<string, unknown>) ??
          (fields.courier_prefs as Record<string, unknown>) ??
          {},
        active: fields.Active !== false && fields.active !== false,
      },
      { onConflict: "slug" }
    )
    .select("id, slug, name")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
