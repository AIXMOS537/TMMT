import type { NegativeItem, NegativeItemType } from "../types";

export type ViolationCode =
  | "fcra_605_expired"
  | "fcra_605a_reporting_period"
  | "fcra_611_no_investigation"
  | "fcra_623_furnisher_duty"
  | "fdcpa_809_validation"
  | "metro2_date_inconsistency"
  | "metro2_balance_anomaly"
  | "metro2_status_conflict"
  | "metro2_missing_fields"
  | "reaging_detected"
  | "duplicate_tradeline"
  | "unauthorized_inquiry"
  | "balance_inflation"
  | "account_not_mine";

export interface DeepAuditFinding {
  code: ViolationCode;
  severity: "critical" | "high" | "medium";
  title: string;
  legalBasis: string;
  confrontationalFact: string;
  removalProbability: number; // 0-100
}

export interface DeepAuditResult {
  item: NegativeItem;
  findings: DeepAuditFinding[];
  overallConfidence: number;
  priority: "P0" | "P1" | "P2";
  recommendedAttack: string;
  eligible: boolean;
}

function yearsSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

function itemTypeAttack(itemType: NegativeItemType): string {
  const attacks: Record<NegativeItemType, string> = {
    collection: "FDCPA validation → 611 → MOV → factual → 623 → CFPB",
    charge_off: "611 verification → MOV → Metro-2 date audit → 623 furnisher",
    late_payment: "Factual date confrontation → goodwill parallel track",
    bankruptcy: "Identity verification → filing date accuracy → court record match",
    foreclosure: "Date of first delinquency audit → reporting period check",
    repossession: "Balance accuracy → deficiency balance challenge",
    tax_lien: "Paid lien removal demand → date accuracy",
    judgment: "Vacated/settled judgment proof → SOL check",
    hard_inquiry: "Permissible purpose challenge → unauthorized access",
    medical_debt: "HIPAA furnisher block → NCRA medical debt rules",
    student_loan: "Servicer transfer verification → balance accuracy",
    other: "Full 611 → MOV → factual → 623 escalation chain",
  };
  return attacks[itemType];
}

export function deepAuditItem(
  item: NegativeItem,
  allItems?: NegativeItem[]
): DeepAuditResult {
  const findings: DeepAuditFinding[] = [];

  if (item.status === "removed" || item.status === "closed") {
    return {
      item,
      findings: [],
      overallConfidence: 0,
      priority: "P2",
      recommendedAttack: "Item already resolved",
      eligible: false,
    };
  }

  // FCRA §605 — expired reporting period
  if (item.dateOfFirstDelinquency) {
    const yrs = yearsSince(item.dateOfFirstDelinquency);
    if (yrs > 7) {
      findings.push({
        code: "fcra_605_expired",
        severity: "critical",
        title: "Exceeds 7-Year Reporting Period",
        legalBasis: "FCRA §605(a) — 7 years from date of first delinquency",
        confrontationalFact: `DOFD ${item.dateOfFirstDelinquency} is ${yrs.toFixed(1)} years ago — this item MUST be deleted immediately under federal law`,
        removalProbability: 92,
      });
    } else if (yrs > 6.5) {
      findings.push({
        code: "fcra_605a_reporting_period",
        severity: "high",
        title: "Approaching Reporting Expiration",
        legalBasis: "FCRA §605(a)",
        confrontationalFact: `DOFD ${item.dateOfFirstDelinquency} — reporting period expires within ${(7 - yrs).toFixed(1)} months`,
        removalProbability: 75,
      });
    }
  }

  // Bankruptcy — 10 year rule
  if (item.itemType === "bankruptcy" && item.dateReported) {
    const yrs = yearsSince(item.dateReported);
    if (yrs > 10) {
      findings.push({
        code: "fcra_605_expired",
        severity: "critical",
        title: "Bankruptcy Exceeds 10-Year Limit",
        legalBasis: "FCRA §605(a)(1) — bankruptcies report max 10 years",
        confrontationalFact: `Bankruptcy filed ${item.dateReported} — ${yrs.toFixed(1)} years ago, exceeds statutory limit`,
        removalProbability: 95,
      });
    }
  }

  // Metro-2 balance anomaly
  if (item.reportedBalanceCents !== undefined) {
    if (item.reportedBalanceCents < 0) {
      findings.push({
        code: "metro2_balance_anomaly",
        severity: "critical",
        title: "Negative Balance — Metro-2 Violation",
        legalBasis: "CDIA Metro-2 Format — Field 13 Balance must be non-negative",
        confrontationalFact: `Reported balance of -$${Math.abs(item.reportedBalanceCents / 100).toFixed(2)} violates Metro-2 reporting standards`,
        removalProbability: 88,
      });
    }
    if (item.itemType === "collection" && item.reportedBalanceCents > 500000) {
      findings.push({
        code: "balance_inflation",
        severity: "high",
        title: "Inflated Collection Balance",
        legalBasis: "FCRA §611 — accuracy requirement",
        confrontationalFact: `Balance of $${(item.reportedBalanceCents / 100).toFixed(2)} requires itemized accounting per FDCPA §809`,
        removalProbability: 70,
      });
    }
  }

  // Missing account number — unverifiable
  if (!item.accountNumberMasked) {
    findings.push({
      code: "metro2_missing_fields",
      severity: "high",
      title: "Missing Account Identifier",
      legalBasis: "FCRA §611(a)(5)(A) — must delete if cannot verify",
      confrontationalFact:
        "No account number provided — furnisher cannot reasonably verify this account belongs to me",
      removalProbability: 72,
      });
  }

  // Hard inquiry — unauthorized
  if (item.itemType === "hard_inquiry") {
    findings.push({
      code: "unauthorized_inquiry",
      severity: "high",
      title: "Unauthorized Hard Inquiry",
      legalBasis: "FCRA §604 — permissible purpose required",
      confrontationalFact: `I did not authorize ${item.furnisherName} to pull my credit — no permissible purpose under §604`,
      removalProbability: 65,
    });
  }

  // Collection — FDCPA validation
  if (item.itemType === "collection") {
    findings.push({
      code: "fdcpa_809_validation",
      severity: "high",
      title: "Debt Validation Required",
      legalBasis: "FDCPA §809(b) — collector must validate before reporting",
      confrontationalFact: `Demand validation of debt, original creditor chain, and license to collect in my state`,
      removalProbability: 68,
    });
  }

  // Medical debt — special rules
  if (item.itemType === "medical_debt") {
    findings.push({
      code: "fcra_623_furnisher_duty",
      severity: "high",
      title: "Medical Debt — Furnisher Block",
      legalBasis: "No Surprises Act + FCRA §623 — medical furnisher obligations",
      confrontationalFact:
        "Medical debt under $500 or paid by insurance must not report — verify billing accuracy and insurance adjudication",
      removalProbability: 74,
    });
  }

  // Duplicate tradeline detection
  if (allItems) {
    const dupes = allItems.filter(
      (other) =>
        other.id !== item.id &&
        other.furnisherName.toLowerCase() === item.furnisherName.toLowerCase() &&
        other.accountNumberMasked === item.accountNumberMasked &&
        other.bureau === item.bureau
    );
    if (dupes.length > 0) {
      findings.push({
        code: "duplicate_tradeline",
        severity: "critical",
        title: "Duplicate Tradeline Detected",
        legalBasis: "FCRA §611 — inaccurate duplicate reporting",
        confrontationalFact: `Same account ${item.furnisherName} appears ${dupes.length + 1} times on ${item.bureau} — duplicate reporting is inaccurate`,
        removalProbability: 85,
      });
    }
  }

  // User-flagged inaccuracies
  if (item.isInaccurate && item.inaccuracyDetails) {
    findings.push({
      code: "account_not_mine",
      severity: "critical",
      title: "Consumer Disputes Accuracy",
      legalBasis: "FCRA §611(a)(1)(A)",
      confrontationalFact: item.inaccuracyDetails,
      removalProbability: 60,
    });
  }

  if (item.isUnverifiable) {
    findings.push({
      code: "fcra_611_no_investigation",
      severity: "high",
      title: "Unverifiable by Furnisher",
      legalBasis: "FCRA §611(a)(5)(A) — delete if cannot verify",
      confrontationalFact: "Prior investigation failed to produce verifiable documentation",
      removalProbability: 78,
    });
  }

  const overallConfidence =
    findings.length === 0
      ? 40
      : Math.round(
          findings.reduce((sum, f) => sum + f.removalProbability, 0) / findings.length
        );

  const priority: "P0" | "P1" | "P2" =
    findings.some((f) => f.severity === "critical") || overallConfidence >= 80
      ? "P0"
      : overallConfidence >= 60
        ? "P1"
        : "P2";

  return {
    item,
    findings,
    overallConfidence,
    priority,
    recommendedAttack: itemTypeAttack(item.itemType),
    eligible: true,
  };
}

export function deepAuditAll(items: NegativeItem[]): DeepAuditResult[] {
  return items
    .map((item) => deepAuditItem(item, items))
    .sort((a, b) => {
      const priorityOrder = { P0: 0, P1: 1, P2: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.overallConfidence - a.overallConfidence;
    });
}

export function confrontationalFacts(audit: DeepAuditResult): string[] {
  return audit.findings.map((f) => `[${f.legalBasis}] ${f.confrontationalFact}`);
}
