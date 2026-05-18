import type { OpsCommand } from "./types";

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const MONEY = /\$?\s*([\d]+(?:\.\d{1,2})?)/;
const CASE_REF = /\b([A-Z]{2,}-[A-Z0-9-]+|\bC-[A-Z0-9]+)\b/i;

/**
 * Lightweight parser so exec can type one sentence in chat.
 * Cursor AI can also send structured JSON and skip this.
 */
export function parseOpsMessage(message: string): OpsCommand[] {
  const text = message.trim();
  const lower = text.toLowerCase();
  const commands: OpsCommand[] = [];

  if (/^(status|what'?s pending|pending|queue|summary)\b/.test(lower)) {
    commands.push({ action: "summary" });
    return commands;
  }

  const approveMatch = lower.match(
    /approve\s+(?:crm|sync)(?:\s+for)?\s+(.+@.+)/
  );
  if (approveMatch) {
    commands.push({
      action: "approve_sync",
      customer_email: approveMatch[1].trim(),
    });
    return commands;
  }

  const assignStaffMatch = text.match(
    /assign\s+(.+@.+?)\s+to\s+(?:case\s+)?([A-Za-z0-9-]+)(?:\s*[-–—]\s*(.+))?$/i
  );
  if (assignStaffMatch) {
    commands.push({
      action: "assign_staff",
      assignee_email: assignStaffMatch[1].trim(),
      case_ref: assignStaffMatch[2].trim(),
      title: assignStaffMatch[3]?.trim(),
    });
    return commands;
  }

  const assignStaffEmailOnly = text.match(/assign\s+(.+@.+?)\s+(?:on|for)\s+case\s+(.+)/i);
  if (assignStaffEmailOnly) {
    commands.push({
      action: "assign_staff",
      assignee_email: assignStaffEmailOnly[1].trim(),
      case_ref: assignStaffEmailOnly[2].trim(),
    });
    return commands;
  }

  const vendorMatch = text.match(
    /assign\s+vendor\s+(.+?)\s+to\s+case\s+([A-Za-z0-9-]+)/i
  );
  if (vendorMatch) {
    commands.push({
      action: "assign_vendor",
      vendor_name: vendorMatch[1].trim(),
      case_ref: vendorMatch[2].trim(),
    });
    return commands;
  }

  const ledgerMatch = text.match(
    /post\s+\$?\s*([\d.]+)\s+(?:dollar|usd|\$)?\s*(?:expense|charge|fee)?\s+to\s+(.+@.+?)(?:\s+for\s+(.+?))?(?:\s+show\s+billing)?$/i
  );
  if (ledgerMatch) {
    commands.push({
      action: "post_ledger",
      amount: parseFloat(ledgerMatch[1]),
      customer_email: ledgerMatch[2].trim(),
      title: ledgerMatch[3]?.trim() || "Charge",
      visible_to_client: /show\s+billing/i.test(text),
      entry_type: "expense",
    });
    return commands;
  }

  const advanceMatch = text.match(
    /(?:move|set)\s+case\s+([A-Za-z0-9-]+)\s+to\s+([a-z_]+)/i
  );
  if (advanceMatch) {
    commands.push({
      action: "advance_case",
      case_ref: advanceMatch[1].trim(),
      to: advanceMatch[2].trim(),
    });
    return commands;
  }

  const email = text.match(EMAIL)?.[0];
  const ref = text.match(CASE_REF)?.[1];
  const money = text.match(MONEY);

  if (email && money && /bill|charge|expense|ledger|post/i.test(text)) {
    commands.push({
      action: "post_ledger",
      customer_email: email,
      amount: parseFloat(money[1]),
      title: "Charge",
      visible_to_client: true,
      entry_type: "expense",
    });
  }

  if (email && /approve|crm|sync/i.test(text)) {
    commands.push({ action: "approve_sync", customer_email: email });
  }

  if (email && ref && /assign/i.test(text)) {
    commands.push({
      action: "assign_staff",
      assignee_email: email,
      case_ref: ref,
    });
  }

  return commands;
}
