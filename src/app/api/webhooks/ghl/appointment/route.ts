import { NextRequest } from "next/server";
import { handleGhlWebhookPost } from "@/lib/ghl/http";

/** GHL appointment booked / updated → `ghl_appointments` */
export async function POST(req: NextRequest) {
  return handleGhlWebhookPost(req, "appointment");
}
