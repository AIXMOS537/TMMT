import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { AppState } from "@aixmos/core";
import { createClient } from "@supabase/supabase-js";
import { createSSRClient } from "@/lib/supabase-server";
import { getTierForUser } from "@/lib/auth-roles";
import {
  loadProgramApplication,
  saveProgramApplication,
} from "@/lib/program-applications-server";

function staffCanAccess(user: User | null): boolean {
  if (!user) return false;
  const tier = getTierForUser(user);
  return tier === "owner" || tier === "staff" || tier === "executive";
}

async function tokenMatchesApplication(
  applicationId: string,
  token: string | null,
): Promise<boolean> {
  if (!token) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const db = createClient(url, key);
  const { data } = await db
    .from("program_applications")
    .select("access_token")
    .eq("id", applicationId)
    .maybeSingle();
  return data?.access_token === token;
}

async function authorizeApplicationAccess(
  applicationId: string,
  token: string | null,
): Promise<boolean> {
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (staffCanAccess(user)) return true;
  return tokenMatchesApplication(applicationId, token);
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const token = request.nextUrl.searchParams.get("token");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  if (!(await authorizeApplicationAccess(id, token))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const state = await loadProgramApplication(id);
    if (!state) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(state);
  } catch (e) {
    const message = e instanceof Error ? e.message : "load failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  let body: AppState;
  try {
    body = (await request.json()) as AppState;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.application?.id) {
    return NextResponse.json({ error: "application.id required" }, { status: 400 });
  }

  const token = request.nextUrl.searchParams.get("token");
  if (!(await authorizeApplicationAccess(body.application.id, token))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await saveProgramApplication(body);
    return NextResponse.json({ ok: true, id: body.application.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "save failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
