import { NextResponse } from "next/server";
import { isAixmosCorsOrigin } from "@/lib/site-domains";
import { isRateLimited } from "@/lib/rate-limit";
import { submitProgramIntake, submitLeadIntake } from "@/app/forms/actions";

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): NextResponse {
  const res = NextResponse.json(body, { status });
  if (origin && isAixmosCorsOrigin(origin)) {
    for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
  }
  return res;
}

export async function OPTIONS(req: Request): Promise<NextResponse> {
  const origin = req.headers.get("origin");
  if (!isAixmosCorsOrigin(origin)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin!) });
}

type Body = {
  form_slug?: string;
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  needs?: string[] | string;
  lane?: string;
  source?: string;
  stage?: string;
  bottleneck?: string;
  goal?: string;
  timeline?: string;
};

export async function POST(req: Request): Promise<NextResponse> {
  const origin = req.headers.get("origin");
  const fail = (body: unknown, status: number) => json(body, status, origin);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) return fail({ error: "Too many submissions. Please try again later." }, 429);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return fail({ error: "Invalid JSON" }, 400);
  }

  const name = String(body.contact_name || body.name || "").trim();
  const email = String(body.email || "").trim();
  const phone = String(body.phone || "").trim();
  if (!name || !phone || !email) return fail({ error: "name, email, and phone required" }, 400);

  const slug = String(body.form_slug || body.source || "apply");
  const needs = Array.isArray(body.needs) ? body.needs.join(",") : String(body.needs || "");
  const notes = [
    body.notes,
    body.stage ? `stage=${body.stage}` : null,
    body.bottleneck ? `bottleneck=${body.bottleneck}` : null,
    body.goal ? `goal=${body.goal}` : null,
    body.timeline ? `timeline=${body.timeline}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const fd = new FormData();
  const programSlugs = new Set(["apply", "academy-join", "operator-apply", "sovereign"]);
  if (programSlugs.has(slug)) {
    fd.set("form_slug", slug);
    fd.set("contact_name", name);
    fd.set("email", email);
    fd.set("phone", phone);
    if (notes) fd.set("notes", notes);
    if (needs) fd.set("needs", needs);
    if (body.lane) fd.set("lane", String(body.lane));
    fd.set("source", body.source || slug);
    const result = await submitProgramIntake(fd);
    if (!result.success) return fail(result, 400);
    return json({ ok: true }, 200, origin);
  }

  fd.set("contact_name", name);
  fd.set("email", email);
  fd.set("phone", phone);
  fd.set("notes", notes);
  fd.set("source", body.source || slug);
  const result = await submitLeadIntake(fd);
  if (!result.success) return fail(result, 400);
  return json({ ok: true }, 200, origin);
}
