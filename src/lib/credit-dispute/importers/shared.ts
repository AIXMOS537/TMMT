import type { CreditBureau, NegativeItemType } from "../types";

export interface TradelineInput {
  creditorName: string;
  accountNumber?: string;
  accountType?: string;
  bureau: CreditBureau;
  status?: string;
  balance?: number;
  creditLimit?: number;
  highBalance?: number;
  paymentStatus?: string;
  dateOpened?: string;
  dateClosed?: string;
  dateOfFirstDelinquency?: string;
  lastReported?: string;
  paymentHistory?: string;
  isNegative: boolean;
  negativeReasons: string[];
}

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

export function classifyNegativeType(tradeline: TradelineInput): NegativeItemType | null {
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

export function detectInaccuracies(tradeline: TradelineInput): {
  isInaccurate: boolean;
  isOutdated: boolean;
  isUnverifiable: boolean;
  details: string[];
} {
  const details: string[] = [];
  let isInaccurate = false;
  let isOutdated = false;
  let isUnverifiable = false;

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

  if (tradeline.balance !== undefined && tradeline.balance < 0) {
    isInaccurate = true;
    details.push("Negative balance reported");
  }

  if (tradeline.status?.toLowerCase() === "closed" && tradeline.balance && tradeline.balance > 0) {
    details.push("Account marked closed but shows outstanding balance");
    isInaccurate = true;
  }

  if (!tradeline.accountNumber) {
    isUnverifiable = true;
    details.push("No account number provided — furnisher may be unable to verify");
  }

  return { isInaccurate, isOutdated, isUnverifiable, details };
}

export function tradelinesToNegativeItems(tradelines: TradelineInput[]): ParsedNegativeItem[] {
  const items: ParsedNegativeItem[] = [];

  for (const tl of tradelines) {
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

  return items;
}

export function parseUnauthorizedInquiries(
  inquiries: Array<{
    creditorName: string;
    bureau: CreditBureau;
    date: string;
    isUnauthorized: boolean;
  }>
): ParsedNegativeItem[] {
  return inquiries
    .filter((inq) => inq.isUnauthorized)
    .map((inq) => ({
      bureau: inq.bureau,
      itemType: "hard_inquiry" as const,
      furnisherName: inq.creditorName,
      dateReported: inq.date,
      isInaccurate: true,
      isOutdated: false,
      isUnverifiable: false,
      inaccuracyDetails:
        "Unauthorized hard inquiry — no permissible purpose under FCRA §604",
    }));
}

export function parseCsvRows(csv: string): Record<string, string>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

export function rowToTradeline(row: Record<string, string>): TradelineInput {
  const isNegative =
    row["status"]?.toLowerCase().includes("derog") ||
    row["status"]?.toLowerCase().includes("collection") ||
    row["status"]?.toLowerCase().includes("charge") ||
    row["negative"] === "true" ||
    row["negative"] === "yes" ||
    row["is_negative"] === "true" ||
    row["is_negative"] === "yes";

  return {
    creditorName:
      row["creditor"] ||
      row["creditor_name"] ||
      row["account_name"] ||
      row["furnisher"] ||
      "Unknown",
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
    negativeReasons: isNegative ? [row["status"] || row["negative_reason"] || "negative"] : [],
  };
}
