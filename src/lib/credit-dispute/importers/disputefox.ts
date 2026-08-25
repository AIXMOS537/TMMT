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

// ─── Dispute Fox intake schema ───────────────────────────────────────
// Dispute Fox has no public API. Operators export client data via
// screen capture + manual structured intake until in-house replaces it.

export const DisputeFoxClientSchema = z.object({
  disputefoxClientId: z.string().optional(),
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
});

export const DisputeFoxTradelineSchema = z.object({
  creditorName: z.string(),
  accountNumber: z.string().optional(),
  accountType: z.string().optional(),
  bureau: z.enum(["experian", "equifax", "transunion"]),
  status: z.string().optional(),
  balance: z.number().optional(),
  creditLimit: z.number().optional(),
  paymentStatus: z.string().optional(),
  dateOpened: z.string().optional(),
  dateClosed: z.string().optional(),
  dateOfFirstDelinquency: z.string().optional(),
  lastReported: z.string().optional(),
  paymentHistory: z.string().optional(),
  isNegative: z.boolean().default(false),
  negativeReasons: z.array(z.string()).default([]),
  disputefoxDisputeStatus: z.string().optional(),
  lastDisputeRound: z.number().optional(),
});

export const DisputeFoxDisputeHistorySchema = z.object({
  roundNumber: z.number(),
  roundType: z.string().optional(),
  bureau: z.enum(["experian", "equifax", "transunion"]),
  furnisherName: z.string(),
  sentDate: z.string().optional(),
  status: z.string().optional(),
  outcome: z.string().nullable().optional(),
});

export const DisputeFoxReportSchema = z.object({
  source: z.literal("disputefox"),
  exportDate: z.string(),
  client: DisputeFoxClientSchema,
  scores: z
    .object({
      experian: z.number().optional(),
      equifax: z.number().optional(),
      transunion: z.number().optional(),
    })
    .optional(),
  tradelines: z.array(DisputeFoxTradelineSchema),
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
  disputeHistory: z.array(DisputeFoxDisputeHistorySchema).default([]),
  screenCaptureUrl: z.string().nullable().optional(),
  notes: z.string().optional(),
});

export type DisputeFoxReport = z.infer<typeof DisputeFoxReportSchema>;
export type DisputeFoxTradeline = z.infer<typeof DisputeFoxTradelineSchema>;

function toTradelineInput(tl: DisputeFoxTradeline): TradelineInput {
  return {
    creditorName: tl.creditorName,
    accountNumber: tl.accountNumber,
    accountType: tl.accountType,
    bureau: tl.bureau,
    status: tl.status,
    balance: tl.balance,
    creditLimit: tl.creditLimit,
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

export function parseDisputeFoxReport(report: DisputeFoxReport): ParsedNegativeItem[] {
  const tradelines = report.tradelines.map(toTradelineInput);
  const fromTradelines = tradelinesToNegativeItems(tradelines);
  const fromInquiries = parseUnauthorizedInquiries(report.inquiries);
  return [...fromTradelines, ...fromInquiries];
}

export function parseDisputeFoxCsv(csv: string): DisputeFoxReport {
  const rows = parseCsvRows(csv);
  const tradelines: DisputeFoxTradeline[] = rows.map((row) => {
    const tl = rowToTradeline(row);
    return {
      creditorName: tl.creditorName,
      accountNumber: tl.accountNumber,
      accountType: tl.accountType,
      bureau: tl.bureau as CreditBureau,
      status: tl.status,
      balance: tl.balance,
      creditLimit: tl.creditLimit,
      dateOpened: tl.dateOpened,
      dateOfFirstDelinquency: tl.dateOfFirstDelinquency,
      lastReported: tl.lastReported,
      isNegative: tl.isNegative,
      negativeReasons: tl.negativeReasons,
      disputefoxDisputeStatus: row["dispute_status"] || undefined,
      lastDisputeRound: row["last_round"] ? parseInt(row["last_round"], 10) : undefined,
    };
  });

  const firstRow = rows[0] ?? {};

  return {
    source: "disputefox",
    exportDate: new Date().toISOString().split("T")[0],
    client: {
      disputefoxClientId: firstRow["client_id"] || firstRow["disputefox_client_id"] || undefined,
      fullName: firstRow["client_name"] || firstRow["full_name"] || "Unknown Client",
      email: firstRow["email"] || undefined,
      phone: firstRow["phone"] || undefined,
    },
    tradelines,
    inquiries: [],
    disputeHistory: [],
  };
}

export { type ParsedNegativeItem };
