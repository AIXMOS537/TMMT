import { notFound } from "next/navigation";
import { MyCreditFlow } from "./my-credit-flow";

/**
 * Customer Credit Center (C2, DEVELOPMENT ONLY).
 *
 * 404 unless CREDIT_CENTER_CUSTOMER=1. Production must not set it until public
 * signup is closed and account provisioning is decided (AUTH-SIGNUP-001).
 */
export const dynamic = "force-dynamic";

export default function MyCreditPage() {
  if (process.env.CREDIT_CENTER_CUSTOMER !== "1") notFound();
  return <MyCreditFlow uploadsEnabled={process.env.CREDIT_EVIDENCE_UPLOADS === "1"} />;
}
