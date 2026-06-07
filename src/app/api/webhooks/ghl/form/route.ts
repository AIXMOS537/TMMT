import { NextRequest } from "next/server";
import { handleGhlWebhookPost } from "@/lib/ghl/http";

/** GHL form submitted → `ghl_form_submissions` (+ case when GHL_FORM_AUTO_CASE ≠ false) */
export async function POST(req: NextRequest) {
  return handleGhlWebhookPost(req, "form");
}
