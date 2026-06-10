/**
 * MVP submission adapter — stub only.
 * Replace with real lender API integrations when available.
 */

export interface SubmissionPayload {
  applicationId: string;
  clientName: string;
  track: string;
  productId: string;
  verifiedAt: string;
}

export interface SubmissionResult {
  success: boolean;
  referenceId: string;
  method: "api_stub" | "manual_prep";
  message: string;
  submittedAt: string;
}

export async function submitApplicationStub(
  payload: SubmissionPayload
): Promise<SubmissionResult> {
  await new Promise((r) => setTimeout(r, 800));

  const referenceId = `AIX-STUB-${payload.applicationId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  return {
    success: true,
    referenceId,
    method: "api_stub",
    message:
      "MVP stub: application packet logged for manual or future API submission. No lender API was called.",
    submittedAt: new Date().toISOString(),
  };
}

export async function prepareManualSubmission(
  payload: SubmissionPayload
): Promise<SubmissionResult> {
  await new Promise((r) => setTimeout(r, 500));

  return {
    success: true,
    referenceId: `AIX-MANUAL-${payload.applicationId.slice(-6).toUpperCase()}`,
    method: "manual_prep",
    message:
      "Application packet prepared for advisor-led manual submission. Client consent on file.",
    submittedAt: new Date().toISOString(),
  };
}
