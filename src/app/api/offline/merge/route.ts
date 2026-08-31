import { NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase-server";
import { getTierForUser } from "@/lib/auth-roles";
import { DESK_TABLES, isDeskTable } from "@/lib/offline/tables";

type MergeItem = { table: string; record: Record<string, unknown> };

function canMerge(tier: string): boolean {
  return tier === "owner" || tier === "staff" || tier === "operator" || tier === "executive";
}

export async function POST(req: Request) {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  const tier = getTierForUser(user);
  if (!canMerge(tier)) {
    return NextResponse.json(
      {
        ok: false,
        needsLink: true,
        error:
          "Your login is live. Ask TMMT to attach this account to an org (the way Khan Strategies was seated). Your local desk data stays on this machine until then.",
      },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as { items?: MergeItem[] } | null;
  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ ok: true, merged: 0 });
  }

  const { data: orgId } = await supabase.rpc("acting_org_id");
  const stampedOrg = typeof orgId === "string" ? orgId : null;

  let merged = 0;
  const errors: string[] = [];

  for (const item of items) {
    if (!item || !isDeskTable(item.table)) {
      errors.push(`skipped ${item?.table ?? "?"}`);
      continue;
    }
    const record = { ...item.record };
    if (stampedOrg && record.org_id == null) record.org_id = stampedOrg;
    delete record.synced;
    const { error } = await supabase.from(item.table).upsert(record);
    if (error) {
      errors.push(`${item.table}: ${error.message}`);
      continue;
    }
    merged += 1;
  }

  return NextResponse.json({
    ok: errors.length === 0,
    merged,
    orgId: stampedOrg,
    errors: errors.slice(0, 8),
    tables: DESK_TABLES,
  });
}
