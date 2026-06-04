import { NextRequest, NextResponse } from "next/server";
import {
  acknowledgeDelivery,
  fetchPartnerInbox,
  verifyPartnerInboxAuth,
} from "@/lib/job-dispatch/deliver-to-apps";

/**
 * Partner app job inbox — poll for dispatched jobs.
 * GET /api/jobs/inbox?vendor_connect
 * Header: X-TMMT-Secret or Authorization: Bearer <secret>
 */
export async function GET(req: NextRequest) {
  const partnerAppSlug = req.nextUrl.searchParams.get("app")?.trim();
  if (!partnerAppSlug) {
    return NextResponse.json({ error: "app query param required" }, { status: 400 });
  }

  if (!verifyPartnerInboxAuth(req, partnerAppSlug)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 100);
  const jobs = await fetchPartnerInbox(partnerAppSlug, limit);

  return NextResponse.json({ ok: true, app: partnerAppSlug, jobs });
}

/**
 * Acknowledge a delivered job.
 * POST { "delivery_id": "uuid" }
 */
export async function POST(req: NextRequest) {
  const partnerAppSlug = req.nextUrl.searchParams.get("app")?.trim();
  if (!partnerAppSlug) {
    return NextResponse.json({ error: "app query param required" }, { status: 400 });
  }

  if (!verifyPartnerInboxAuth(req, partnerAppSlug)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const deliveryId = typeof json?.delivery_id === "string" ? json.delivery_id : null;
  if (!deliveryId) {
    return NextResponse.json({ error: "delivery_id required" }, { status: 400 });
  }

  const ok = await acknowledgeDelivery(deliveryId, partnerAppSlug);
  if (!ok) {
    return NextResponse.json({ error: "ack failed" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, delivery_id: deliveryId, status: "acknowledged" });
}
