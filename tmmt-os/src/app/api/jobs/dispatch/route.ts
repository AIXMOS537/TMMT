import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createStaffDispatchJob } from "@/lib/job-dispatch/create-dispatch-job";
import { DISPATCH_WORK_TYPES } from "@/lib/job-dispatch/types";

const Body = z.object({
  vendor_company: z.string().min(1),
  vendor_contact_name: z.string().optional(),
  vendor_contact_email: z.string().email().optional(),
  vendor_contact_phone: z.string().optional(),
  assign_vendor_id: z.string().uuid().optional(),
  work_type: z.enum(DISPATCH_WORK_TYPES),
  subject: z.string().min(1),
  details: z.string().optional(),
  pickup: z.string().optional(),
  dropoff: z.string().optional(),
  window_start: z.string().optional(),
  window_end: z.string().optional(),
  offered_price: z.number().optional(),
  due_at: z.string().optional(),
  target_partner_apps: z.array(z.string()).optional(),
});

async function resolveActor(req: NextRequest) {
  const secret = process.env.JOB_DISPATCH_SECRET?.trim() ?? process.env.OPS_COMMAND_SECRET?.trim();
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  if (secret && bearer && bearer === secret) {
    return { id: "job-dispatch-api", email: "job-dispatch@system" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "internal_team"].includes(profile.role as string)) {
    return null;
  }

  return { id: profile.id, email: user.email };
}

/**
 * Staff dispatch job intake — local vendor outsources work to TMMT.
 * Auth: staff session OR Authorization: Bearer $JOB_DISPATCH_SECRET (falls back to OPS_COMMAND_SECRET)
 */
export async function POST(req: NextRequest) {
  const actor = await resolveActor(req);
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await createStaffDispatchJob({
      ...parsed.data,
      actor_id: actor.id,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "dispatch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
