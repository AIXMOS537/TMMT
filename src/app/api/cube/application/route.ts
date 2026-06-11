import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { AppState } from "@aixmos/core";
import {
  loadProgramApplication,
  saveProgramApplication,
} from "@/lib/program-applications-server";
import { isRateLimited } from "@/lib/rate-limit";

// Service-role client for the per-application access_token lookup. Kept local
// to this route — it's the auth check itself, not a general-purpose accessor.
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Verify the caller's access_token matches the row's. The token is the per-
 * application bearer minted in createProgramApplicationFromGhl and embedded
 * in the learn deep link. Pre-fix, both GET and PUT were unauthenticated —
 * anyone who knew or guessed an application UUID could read PII and overwrite
 * any column. Now: token mismatch / missing token → 401, no leak about
 * whether the application ID was valid.
 */
async function authorize(id: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  try {
    const supabase = serviceClient();
    const { data } = await supabase
      .from("program_applications")
      .select("access_token")
      .eq("id", id)
      .maybeSingle();
    if (!data?.access_token) return false;
    const stored = String(data.access_token);
    if (stored.length !== token.length) return false;
    return timingSafeEqual(Buffer.from(stored, "utf8"), Buffer.from(token, "utf8"));
  } catch {
    return false;
  }
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]?.trim() || "unknown";
}

// PUT body schema. Requires the application id; passthrough preserves
// downstream typing (@aixmos/core AppState governs inner shape) while
// rejecting top-level garbage. Future hardening: per-field strict zod.
const PutBodySchema = z
  .object({
    application: z.object({ id: z.string().min(1) }).passthrough(),
  })
  .passthrough();

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const token = request.nextUrl.searchParams.get("token");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (isRateLimited(`cube-app:${clientIp(request)}`, { windowMs: 60_000, maxHits: 30 })) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  if (!(await authorize(id, token))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const state = await loadProgramApplication(id);
    if (!state) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(state);
  } catch (e) {
    // Don't leak schema details from caught errors.
    console.error("[cube/application] load failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "load failed" }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PutBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Cast via unknown: zod's loose schema accepts the AppState shape via
  // passthrough but the static types don't overlap; saveProgramApplication
  // enforces the real shape downstream.
  const body = parsed.data as unknown as AppState;
  const id = body.application.id;
  const token =
    request.nextUrl.searchParams.get("token") ??
    request.headers.get("x-application-token");

  if (isRateLimited(`cube-app:${clientIp(request)}`, { windowMs: 60_000, maxHits: 30 })) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  if (!(await authorize(id, token))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await saveProgramApplication(body);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[cube/application] save failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "save failed" }, { status: 503 });
  }
}
