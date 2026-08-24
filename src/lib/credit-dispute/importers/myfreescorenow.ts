import { z } from "zod";
import type { CreditBureau } from "../types";
import {
  parseCsvRows,
  parseUnauthorizedInquiries,
  rowToTradeline,
  tradelinesToNegativeItems,
  type ParsedNegativeItem,
  type TradelineInput,
} from "./shared";

// ─── MyFreeScoreNow intake schema ────────────────────────────────────
// MFSN provides affiliate credit monitoring + 3-bureau score/report access.
// No public API — operators capture report data via affiliate portal.

export const MfsnTradelineSchema = z.object({
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

export const MfsnReportSchema = z.object({
  source: z.literal("myfreescorenow"),
  pullDate: z.string(),
  memberId: z.string().optional(),
  affiliateRef: z.string().optional(),
  enrollmentDate: z.string().optional(),
  client: z
    .object({
      fullName: z.string(),
      email: z.string().optional(),
      phone: z.string().optional(),
      dateOfBirth: z.string().optional(),
      ssnLast4: z.string().optional(),
      address: z
        .object({
          street: z.string(),
          city: z.string(),
          state: z.string(),
          zip: z.string(),
        })
        .optional(),
    })
    .optional(),
  scores: z
    .object({
      experian: z.number().optional(),
      equifax: z.number().optional(),
      transunion: z.number().optional(),
      scoreModel: z.string().optional(),
    })
    .optional(),
  tradelines: z.array(MfsnTradelineSchema),
  inquiries: z
    .array(
      z.object({
        creditorName: z.string(),
        bureau: z.enum(["experian", "equifax", "transunion"]),
        date: z.string(),
        inquiryType: z.string().optional(),
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
  screenCaptureUrl: z.string().nullable().optional(),
});

export type MfsnReport = z.infer<typeof MfsnReportSchema>;
export type MfsnTradeline = z.infer<typeof MfsnTradelineSchema>;

function toTradelineInput(tl: MfsnTradeline): TradelineInput {
  return {
    creditorName: tl.creditorName,
    accountNumber: tl.accountNumber,
    accountType: tl.accountType,
    bureau: tl.bureau,
    status: tl.status,
    balance: tl.balance,
    creditLimit: tl.creditLimit,
    highBalance: tl.highBalance,
    paymentStatus: tl.paymentStatus,
    dateOpened: tl.dateOpened,
    dateClosed: tl.dateClosed,
    dateOfFirstDelinquency: tl.dateOfFirstDelinquency,
    lastReported: tl.lastReported,
    paymentHistory: tl.paymentHistory,
    isNegative: tl.isNegative,
    negativeReasons: tl.negativeReasons,
  };
}

function publicRecordToNegative(
  record: z.infer<typeof MfsnReportSchema>["publicRecords"][number]
): ParsedNegativeItem | null {
  const typeMap: Record<string, ParsedNegativeItem["itemType"]> = {
    bankruptcy: "bankruptcy",
    foreclosure: "foreclosure",
    "tax lien": "tax_lien",
    judgment: "judgment",
    repossession: "repossession",
  };

  const itemType = typeMap[record.type.toLowerCase()] ?? "other";

  return {
    bureau: record.bureau,
    itemType,
    furnisherName: record.type,
    reportedBalanceCents: record.amount ? Math.round(record.amount * 100) : undefined,
    dateReported: record.filingDate,
    isInaccurate: false,
    isOutdated: false,
    isUnverifiable: false,
    inaccuracyDetails: record.status ? `Public record status: ${record.status}` : "",
  };
}

export function parseMfsnReport(report: MfsnReport): ParsedNegativeItem[] {
  const tradelines = report.tradelines.map(toTradelineInput);
  const fromTradelines = tradelinesToNegativeItems(tradelines);
  const fromInquiries = parseUnauthorizedInquiries(report.inquiries);
  const fromPublicRecords = report.publicRecords
    .map(publicRecordToNegative)
    .filter((item): item is ParsedNegativeItem => item !== null);

  return [...fromTradelines, ...fromInquiries, ...fromPublicRecords];
}

export function parseMfsnCsv(csv: string): MfsnReport {
  const rows = parseCsvRows(csv);
  const tradelines: MfsnTradeline[] = rows.map((row) => {
    const tl = rowToTradeline(row);
    return {
      creditorName: tl.creditorName,
      accountNumber: tl.accountNumber,
      accountType: tl.accountType,
      bureau: tl.bureau as CreditBureau,
      status: tl.status,
      balance: tl.balance,
      creditLimit: tl.creditLimit,
      highBalance: tl.highBalance,
      dateOpened: tl.dateOpened,
      dateOfFirstDelinquency: tl.dateOfFirstDelinquency,
      lastReported: tl.lastReported,
      isNegative: tl.isNegative,
      negativeReasons: tl.negativeReasons,
    };
  });

  const firstRow = rows[0] ?? {};

  return {
    source: "myfreescorenow",
    pullDate: firstRow["pull_date"] || new Date().toISOString().split("T")[0],
    memberId: firstRow["member_id"] || undefined,
    affiliateRef: firstRow["affiliate_ref"] || undefined,
    client: {
      fullName: firstRow["client_name"] || firstRow["full_name"] || "Unknown Client",
      email: firstRow["email"] || undefined,
    },
    tradelines,
    inquiries: [],
    publicRecords: [],
  };
}

export { type ParsedNegativeItem };
