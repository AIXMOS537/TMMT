import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { secretMatches } from "@/lib/secure-compare";

const LocationRow = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  ghl_pipeline_id: z.string().optional(),
  ghl_pipeline_name: z.string().optional(),
  clickup_list_id: z.string().optional(),
  overseas_assignee_email: z.string().email().optional(),
  courier_prefs: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
});

const Body = z.object({
  locations: z.array(LocationRow).min(1),
});

/**
 * Sync ops_locations from Airtable automation (you + systems engineer).
 * Header: X-Sync-Secret (same as SYNC_WEBHOOK_SECRET)
 *
 * No replay guard, by decision (T-02c). The payload has no delivery id or
 * timestamp, and the only effect is an upsert keyed on slug with the full row
 * from the body: a retried delivery re-writes identical state and nothing
 * else happens (no tag, no message, no event log). A guard would have to key
 * on a content hash, and the Airtable roster automation legitimately re-sends
 * unchanged rows after any edit — the guard would drop those. Convergence is
 * pinned in route.test.ts.
 */
export async function POST(req: NextRequest) {
  if (!secretMatches(req.headers.get("x-sync-secret"), process.env.SYNC_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
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
