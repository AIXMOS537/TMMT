export const LEDGER_ENTRY_TYPES = [
  "deposit",
  "deposit_return",
  "payment",
  "deduction",
  "expense",
  "refund",
] as const;

export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const LEDGER_STATUSES = ["pending", "processing", "completed", "cancelled"] as const;

export type LedgerEntryStatus = (typeof LEDGER_STATUSES)[number];

export type LedgerSource = "team" | "investor" | "vendor" | "system";

export type LedgerEntry = {
  id: string;
  customer_email: string;
  customer_name: string | null;
  entry_type: LedgerEntryType;
  status: LedgerEntryStatus;
  title: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  due_at: string | null;
  completed_at: string | null;
  visible_to_client: boolean;
  source: string;
  case_id: string | null;
  booking_id: string | null;
  created_at: string;
  created_by: string | null;
};

export const LEDGER_TYPE_LABEL: Record<LedgerEntryType, string> = {
  deposit: "Security deposit",
  deposit_return: "Deposit return",
  payment: "Payment",
  deduction: "Deduction",
  expense: "Expense",
  refund: "Refund",
};
