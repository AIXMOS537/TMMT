import { NextRequest } from "next/server";
import { handleGhlWebhookPost } from "@/lib/ghl/http";

/** GHL contact created / updated → `ghl_contacts` */
export async function POST(req: NextRequest) {
  return handleGhlWebhookPost(req, "contact");
}
