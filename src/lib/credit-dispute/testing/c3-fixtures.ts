/**
 * Test fixtures for C3 (tests only). A person-verified recipient registry built
 * from the legacy seeds, and approvals for every template's CURRENT wording.
 * Production starts with neither, which is the point: nothing can be addressed or
 * rendered until a person verifies and approves.
 */
import { legacySeedRegistry, verifyRecipientVersion, type RecipientVersion } from "../recipients/registry";
import { APPROVABLE_TEMPLATES, recordTemplateApproval, templateFingerprint, type TemplateApproval } from "../approvals/template-approvals";

export function verifiedRegistry(now = "2026-09-22T00:00:00.000Z"): RecipientVersion[] {
  let reg: RecipientVersion[] = legacySeedRegistry(now);
  for (const v of [...reg]) {
    reg = verifyRecipientVersion(reg, v.recipientId, v.version, "verified", "checked against the published dispute address (test)", "owner@example.test", now);
  }
  return reg;
}

export function approvalsForCurrentWording(now = "2026-09-22T00:00:00.000Z"): TemplateApproval[] {
  let list: TemplateApproval[] = [];
  for (const rt of APPROVABLE_TEMPLATES) {
    const fp = templateFingerprint(rt);
    list = recordTemplateApproval(list, { id: `appr-${rt}`, roundType: rt, fingerprint: fp, reference: "TEST-COUNSEL-REF-1", approver: "owner@example.test" }, fp, now);
  }
  return list;
}

/** Rows as the loaders read them from the staged tables. */
export const recipientRows = (reg = verifiedRegistry()) => reg.map((record) => ({ record }));
export const approvalRows = (list = approvalsForCurrentWording()) => list.map((record) => ({ record }));
