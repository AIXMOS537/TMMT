import { z } from "zod";
import type { CreditBureau, NegativeItemType } from "../types";

// ─── Smart Credit JSON import schema ─────────────────────────────────
// Smart Credit reports can be captured via screen recording + manual export
// until automated parsing is live. This schema handles structured intake.

export const SmartCreditTradelineSchema = z.object({
  creditorName: z.string(),
  accountNumber: z.string().optional(),
  accountType: z.string().optional(),
  bureau: z.enum(["experian", "equifax", "transunion"]),
  status: z.string().optional(),
  balance: z.number().optional(),
  creditLimit: z.number().optional(),
  highBalance: z.number().optional(),
  paymentStatus: z.string().optional(),
  dateOpened: z.string().optional(),
  dateClosed: z.string().optional(),
  dateOfFirstDelinquency: z.string().optional(),
  lastReported: z.string().optional(),
  paymentHistory: z.string().optional(),
  isNegative: z.boolean().default(false),
  negativeReasons: z.array(z.string()).default([]),
});

export const SmartCreditReportSchema = z.object({
  source: z.literal("smartcredit"),
  pullDate: z.string(),
  memberId: z.string().optional(),
  scores: z
    .object({
      experian: z.number().optional(),
      equifax: z.number().optional(),
      transunion: z.number().optional(),
    })
    .optional(),
  tradelines: z.array(SmartCreditTradelineSchema),
  inquiries: z
    .array(
      z.object({
        creditorName: z.string(),
        bureau: z.enum(["experian", "equifax", "transunion"]),
        date: z.string(),
        isUnauthorized: z.boolean().default(false),
      })
    )
    .default([]),
  publicRecords: z
    .array(
      z.object({
        type: z.string(),
        bureau: z.enum(["experian", "equifax", "transunion"]),
        filingDate: z.string().optional(),
        amount: z.number().optional(),
        status: z.string().optional(),
      })
    )
    .default([]),
});

export type SmartCreditReport = z.infer<typeof SmartCreditReportSchema>;
export type SmartCreditTradeline = z.infer<typeof SmartCreditTradelineSchema>;

// ─── Classify tradeline into negative item type ───────────────────────

export function classifyNegativeType(
  tradeline: SmartCreditTradeline
): NegativeItemType | null {
  if (!tradeline.isNegative) return null;

  const reasons = tradeline.negativeReasons.join(" ").toLowerCase();
  const status = (tradeline.status ?? "").toLowerCase();
  const creditor = tradeline.creditorName.toLowerCase();

  if (reasons.includes("collection") || creditor.includes("collection")) return "collection";
  if (status.includes("charge") || reasons.includes("charge off")) return "charge_off";
  if (reasons.includes("late") || status.includes("late")) return "late_payment";
  if (reasons.includes("bankruptcy")) return "bankruptcy";
  if (reasons.includes("foreclosure")) return "foreclosure";
  if (reasons.includes("repossession")) return "repossession";
  if (reasons.includes("tax lien")) return "tax_lien";
  if (reasons.includes("judgment")) return "judgment";
  if (reasons.includes("medical")) return "medical_debt";
  if (reasons.includes("student")) return "student_loan";

  return "other";
}

// ─── Detect factual issues from tradeline data ───────────────────────

export function detectInaccuracies(tradeline: SmartCreditTradeline): {
  isInaccurate: boolean;
  isOutdated: boolean;
  isUnverifiable: boolean;
  details: string[];
} {
  const details: string[] = [];
  let isInaccurate = false;
  let isOutdated = false;
  let isUnverifiable = false;

  // 7-year rule
  if (tradeline.dateOfFirstDelinquency) {
    const dof = new Date(tradeline.dateOfFirstDelinquency);
    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);
    if (dof < sevenYearsAgo) {
      isOutdated = true;
      details.push(
        `DOFD ${tradeline.dateOfFirstDelinquency} exceeds 7-year reporting period (FCRA §605)`
      );
    }
  }

  // Balance anomalies
  if (tradeline.balance !== undefined && tradeline.balance < 0) {
    isInaccurate = true;
    details.push("Negative balance reported");
  }

  // Status contradictions
  if (tradeline.status?.toLowerCase() === "closed" && tradeline.balance && tradeline.balance > 0) {
    details.push("Account marked closed but shows outstanding balance");
    isInaccurate = true;
  }

  // Missing account number (harder to verify)
  if (!tradeline.accountNumber) {
    isUnverifiable = true;
    details.push("No account number provided — furnisher may be unable to verify");
  }

  return { isInaccurate, isOutdated, isUnverifiable, details };
}

// ─── Convert Smart Credit report to negative items ───────────────────

export interface ParsedNegativeItem {
  bureau: CreditBureau;
  itemType: NegativeItemType;
  furnisherName: string;
  accountNumberMasked?: string;
  reportedBalanceCents?: number;
  dateReported?: string;
  dateOfFirstDelinquency?: string;
  isInaccurate: boolean;
  isOutdated: boolean;
  isUnverifiable: boolean;
  inaccuracyDetails: string;
}

export function parseSmartCreditReport(report: SmartCreditReport): ParsedNegativeItem[] {
  const items: ParsedNegativeItem[] = [];

  for (const tl of report.tradelines) {
    const itemType = classifyNegativeType(tl);
    if (!itemType) continue;

    const audit = detectInaccuracies(tl);

    items.push({
      bureau: tl.bureau,
      itemType,
      furnisherName: tl.creditorName,
      accountNumberMasked: tl.accountNumber
        ? `****${tl.accountNumber.slice(-4)}`
        : undefined,
      reportedBalanceCents: tl.balance ? Math.round(tl.balance * 100) : undefined,
      dateReported: tl.lastReported,
      dateOfFirstDelinquency: tl.dateOfFirstDelinquency,
      isInaccurate: audit.isInaccurate,
      isOutdated: audit.isOutdated,
      isUnverifiable: audit.isUnverifiable,
      inaccuracyDetails: audit.details.join("; "),
    });
  }

  // Unauthorized inquiries
  for (const inq of report.inquiries) {
    if (inq.isUnauthorized) {
      items.push({
        bureau: inq.bureau,
        itemType: "hard_inquiry",
        furnisherName: inq.creditorName,
        dateReported: inq.date,
        isInaccurate: true,
        isOutdated: false,
        isUnverifiable: false,
        inaccuracyDetails: "Unauthorized hard inquiry — no permissible purpose under FCRA §604",
      });
    }
  }

  return items;
}

// ─── Parse CSV export (manual fallback) ──────────────────────────────

export function parseSmartCreditCsv(csv: string): SmartCreditReport {
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  const tradelines: SmartCreditTradeline[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });

    const isNegative =
      row["status"]?.toLowerCase().includes("derog") ||
      row["status"]?.toLowerCase().includes("collection") ||
      row["status"]?.toLowerCase().includes("charge") ||
      row["negative"] === "true" ||
      row["negative"] === "yes";

    tradelines.push({
      creditorName: row["creditor"] || row["creditor_name"] || row["account_name"] || "Unknown",
      accountNumber: row["account_number"] || row["account"] || undefined,
      accountType: row["account_type"] || row["type"] || undefined,
      bureau: (row["bureau"]?.toLowerCase() || "experian") as CreditBureau,
      status: row["status"] || undefined,
      balance: row["balance"] ? parseFloat(row["balance"]) : undefined,
      creditLimit: row["credit_limit"] ? parseFloat(row["credit_limit"]) : undefined,
      dateOpened: row["date_opened"] || undefined,
      dateOfFirstDelinquency: row["dofd"] || row["date_of_first_delinquency"] || undefined,
      lastReported: row["last_reported"] || row["date_reported"] || undefined,
      isNegative,
      negativeReasons: isNegative ? [row["status"] || "negative"] : [],
    });
  }

  return {
    source: "smartcredit",
    pullDate: new Date().toISOString().split("T")[0],
    tradelines,
    inquiries: [],
    publicRecords: [],
  };
}
