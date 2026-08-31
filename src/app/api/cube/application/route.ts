import { NextRequest, NextResponse } from "next/server";
import type { AppState } from "@aixmos/core";
import {
  fetchApplicationGuard,
  loadProgramApplication,
  saveProgramApplication,
} from "@/lib/program-applications-server";
import { createSSRClient } from "@/lib/supabase-server";
import { isStaffUser } from "@/lib/auth-roles";
import { timingSafeEqualString } from "@/lib/ghl/webhook-auth";

/**
 * Read and write one credit/funding application.
 *
 * These handlers run on a service-role client, which bypasses RLS — so the
 * database will not second-guess them and every check has to live here. They
 * previously had none at all: GET returned a whole application for any id in
 * the query string, and PUT upserted whatever JSON was posted, keyed on an id
 * in the body. That row holds legal name, date of birth, home address, income,
 * monthly obligations and credit-score range, and PUT could also flip
 * client_consent_given and consent_timestamp — the record of whether a person
 * agreed to any of this.
 *
 * A caller is authorized two ways, matching the two ways the application is
 * legitimately reached:
 *
 *   - the access token minted with the row and mailed out inside learnDeepLink,
 *     which grants exactly the one application it belongs to; or
 *   - a signed-in session, which grants staff any application and everyone else
 *     only the one filed under their own email address.
 *
 * An unknown id and an unauthorized one both answer 404. Distinguishing them
 * would confirm to a stranger that a given application exists.
 */

type Access = "granted" | "denied";

async function authorize(
  applicationId: string,
  suppliedToken: string | null
): Promise<Access> {
  const guard = await fetchApplicationGuard(applicationId);
  if (!guard) return "denied";

  if (
    suppliedToken &&
    guard.accessToken &&
    timingSafeEqualString(suppliedToken, guard.accessToken)
  ) {
    return "granted";
  }

  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "denied";

  if (isStaffUser(user)) return "granted";

  const sessionEmail = user.email?.trim().toLowerCase();
  const ownerEmail = guard.email?.trim().toLowerCase();
  if (sessionEmail && ownerEmail && sessionEmail === ownerEmail) return "granted";

  return "denied";
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const token = request.nextUrl.searchParams.get("token");
  if ((await authorize(id, token)) === "denied") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
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

  const id = body?.application?.id;
  if (!id) {
    return NextResponse.json({ error: "application.id required" }, { status: 400 });
  }

  // The token rides in the query string on writes too — the body is the thing
  // being authorized, so it cannot also be what authorizes it.
  const token = request.nextUrl.searchParams.get("token");
  if ((await authorize(id, token)) === "denied") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    await saveProgramApplication(body);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "save failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
