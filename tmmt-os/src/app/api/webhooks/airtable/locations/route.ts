import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const LocationRow = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  ghl_pipeline_id: z.string().optional(),
  ghl_pipeline_name: z.string().optional(),
  clickup_list_id: z.string().optional(),
  overseas_assignee_email: z.string().email().optional(),
  courier_prefs: z.record(z.unknown()).optional(),
  active: z.boolean().optional(),
});

const Body = z.object({
  locations: z.array(LocationRow).min(1),
});

/**
 * Sync ops_locations from Airtable automation (you + systems engineer).
 * Header: X-Sync-Secret (same as SYNC_WEBHOOK_SECRET)
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SYNC_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-sync-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const results: { slug: string; ok: boolean; error?: string }[] = [];

  for (const loc of parsed.data.locations) {
    const { error } = await supabase.from("ops_locations").upsert(
      {
        slug: loc.slug,
        name: loc.name,
        ghl_pipeline_id: loc.ghl_pipeline_id ?? null,
        ghl_pipeline_name: loc.ghl_pipeline_name ?? null,
        clickup_list_id: loc.clickup_list_id ?? null,
        overseas_assignee_email: loc.overseas_assignee_email ?? null,
        courier_prefs: loc.courier_prefs ?? {},
        active: loc.active ?? true,
      },
      { onConflict: "slug" }
    );
    results.push({ slug: loc.slug, ok: !error, error: error?.message });
  }

  return NextResponse.json({ ok: true, results });
}
