import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LedgerEntry, LedgerEntryType } from "./types";

export type LedgerSummary = {
  pendingDepositCents: number;
  pendingRefundCents: number;
  deductionCents: number;
  expenseCents: number;
};

export function summarizeLedger(entries: Pick<LedgerEntry, "entry_type" | "status" | "amount_cents">[]): LedgerSummary {
  let pendingDepositCents = 0;
  let pendingRefundCents = 0;
  let deductionCents = 0;
  let expenseCents = 0;

  for (const e of entries) {
    const open = e.status === "pending" || e.status === "processing";
    if (!open && e.status !== "completed") continue;
    if (e.entry_type === "deposit" && open) pendingDepositCents += e.amount_cents;
    if ((e.entry_type === "deposit_return" || e.entry_type === "refund") && open) {
      pendingRefundCents += e.amount_cents;
    }
    if (e.entry_type === "deduction") deductionCents += e.amount_cents;
    if (e.entry_type === "expense") expenseCents += e.amount_cents;
  }

  return { pendingDepositCents, pendingRefundCents, deductionCents, expenseCents };
}

export async function listLedgerEntries(opts?: {
  customerEmail?: string;
  clientVisibleOnly?: boolean;
  limit?: number;
}): Promise<LedgerEntry[]> {
  const supabase = createSupabaseServerClient();
  let q = supabase
    .from("rental_ledger")
    .select(
      "id, customer_email, customer_name, entry_type, status, title, description, amount_cents, currency, due_at, completed_at, visible_to_client, source, case_id, booking_id, created_at, created_by"
    )
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.customerEmail) {
    q = q.ilike("customer_email", opts.customerEmail.trim());
  }
  if (opts?.clientVisibleOnly) {
    q = q.eq("visible_to_client", true);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as LedgerEntry[];
}

export async function listLedgerForCase(caseId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("rental_ledger")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LedgerEntry[];
}

export async function searchCustomerEmails(query: string, limit = 8) {
  const supabase = createSupabaseServerClient();
  const term = query.trim();
  if (term.length < 2) return [];

  const [casesRes, syncRes] = await Promise.all([
    supabase
      .from("cases")
      .select("customer_email, customer_name")
      .ilike("customer_email", `%${term}%`)
      .not("customer_email", "is", null)
      .limit(limit),
    supabase
      .from("crm_sync_records")
      .select("customer_email, customer_name")
      .ilike("customer_email", `%${term}%`)
      .not("customer_email", "is", null)
      .limit(limit),
  ]);

  const map = new Map<string, string | null>();
  for (const row of [...(casesRes.data ?? []), ...(syncRes.data ?? [])]) {
    if (row.customer_email) {
      map.set(row.customer_email.toLowerCase(), row.customer_name ?? null);
    }
  }
  return Array.from(map.entries()).map(([email, name]) => ({ email, name }));
}
