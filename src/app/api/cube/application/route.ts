import { NextRequest, NextResponse } from "next/server";
import type { AppState } from "@aixmos/core";
import {
  loadProgramApplication,
  saveProgramApplication,
} from "@/lib/program-applications-server";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
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

  try {
    await saveProgramApplication(body);
    return NextResponse.json({ ok: true, id: body.application.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "save failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
