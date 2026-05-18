import type { OpsCommand } from "./types";

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const MONEY = /\$?\s*([\d]+(?:\.\d{1,2})?)/;
const CASE_REF = /\b([A-Z]{2,}-[A-Z0-9-]+|C-[A-Z0-9]+)\b/i;

/** Normalize voice / mobile punctuation so regexes match reliably. */
export function normalizeOpsMessage(message: string): string {
  return message
    .trim()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

function firstEmail(text: string): string | undefined {
  const m = text.match(EMAIL);
  return m?.[0]?.toLowerCase();
}

function allEmails(text: string): string[] {
  return [...text.matchAll(EMAIL)].map((m) => m[0].toLowerCase());
}

function wantsSummary(lower: string): boolean {
  if (/^(help|hi|hello)\b/.test(lower)) return true;
  if (/^(status|summary|queue)\b/.test(lower)) return true;
  if (/^pending\b/.test(lower)) return true;
  if (/\bwhat\s+is\s+pending\b/.test(lower)) return true;
  if (/\bwhat'?s\s+pending\b/.test(lower)) return true;
  if (/\b(show|list|check)\s+(me\s+)?(the\s+)?(pending|queue)\b/.test(lower)) return true;
  if (/\b(pending|queue)\s+(work|items|stuff|tasks)\b/.test(lower)) return true;
  if (/\banything\s+pending\b/.test(lower)) return true;
  if (lower === "pending" || lower === "queue" || lower === "status") return true;
  return false;
}

/**
 * Lightweight parser so exec can type one sentence in chat (or voice).
 */
export function parseOpsMessage(raw: string): OpsCommand[] {
  const text = normalizeOpsMessage(raw);
  if (!text) return [];

  const lower = text.toLowerCase();
  const commands: OpsCommand[] = [];

  if (wantsSummary(lower)) {
    return [{ action: "summary" }];
  }

  const approveMatch = lower.match(
    /(?:approve|verify|confirm)\s+(?:crm|sync|pipeline)?(?:\s+for)?\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/
  );
  if (approveMatch) {
    return [{ action: "approve_sync", customer_email: approveMatch[1].trim() }];
  }

  const vendorMatch = text.match(
    /(?:assign\s+)?vendor\s+(.+?)\s+to\s+(?:case\s+)?([A-Za-z0-9-]+)/i
  );
  if (vendorMatch) {
    return [
      {
        action: "assign_vendor",
        vendor_name: vendorMatch[1].trim(),
        case_ref: vendorMatch[2].trim(),
      },
    ];
  }

  const assignToCase = text.match(
    /assign\s+(.+@.+?)\s+to\s+(?:case\s+)?([A-Za-z0-9-]+)(?:\s*[-–—:]\s*(.+))?$/i
  );
  if (assignToCase) {
    return [
      {
        action: "assign_staff",
        assignee_email: assignToCase[1].trim(),
        case_ref: assignToCase[2].trim(),
        title: assignToCase[3]?.trim(),
      },
    ];
  }

  const assignCaseTo = text.match(
    /assign\s+(?:case\s+)?([A-Za-z0-9-]+)\s+to\s+(.+@.+)$/i
  );
  if (assignCaseTo) {
    return [
      {
        action: "assign_staff",
        case_ref: assignCaseTo[1].trim(),
        assignee_email: assignCaseTo[2].trim(),
      },
    ];
  }

  const assignOnCase = text.match(/assign\s+(.+@.+?)\s+(?:on|for)\s+case\s+(.+)/i);
  if (assignOnCase) {
    return [
      {
        action: "assign_staff",
        assignee_email: assignOnCase[1].trim(),
        case_ref: assignOnCase[2].trim(),
      },
    ];
  }

  const ledgerMatch = text.match(
    /(?:post|add|charge|bill)\s+\$?\s*([\d.]+)\s*(?:dollars?|usd)?\s*(?:expense|charge|fee)?\s*(?:to|for)\s+(.+@.+?)(?:\s+for\s+(.+?))?(?:\s+show\s+billing)?$/i
  );
  if (ledgerMatch) {
    return [
      {
        action: "post_ledger",
        amount: parseFloat(ledgerMatch[1]),
        customer_email: ledgerMatch[2].trim(),
        title: ledgerMatch[3]?.trim() || "Charge",
        visible_to_client: /show\s+billing|visible|customer/i.test(text),
        entry_type: "expense",
      },
    ];
  }

  const advanceMatch = text.match(
    /(?:move|set|mark)\s+case\s+([A-Za-z0-9-]+)\s+(?:to|as)\s+([a-z_]+)/i
  );
  if (advanceMatch) {
    return [
      {
        action: "advance_case",
        case_ref: advanceMatch[1].trim(),
        to: advanceMatch[2].trim(),
      },
    ];
  }

  const emails = allEmails(text);
  const ref = text.match(CASE_REF)?.[1];
  const money = text.match(MONEY);

  if (emails.length >= 1 && money && /bill|charge|expense|ledger|post|add|\$/i.test(text)) {
    commands.push({
      action: "post_ledger",
      customer_email: emails[emails.length - 1],
      amount: parseFloat(money[1]),
      title: "Charge",
      visible_to_client: /show\s+billing|visible|customer/i.test(text),
      entry_type: "expense",
    });
  }

  if (emails.length >= 1 && /approve|verify|crm|sync/i.test(text)) {
    commands.push({ action: "approve_sync", customer_email: emails[0] });
  }

  if (emails.length >= 2 && ref && /assign/i.test(text)) {
    commands.push({
      action: "assign_staff",
      assignee_email: emails[0],
      case_ref: ref,
    });
  } else if (emails.length === 1 && ref && /assign/i.test(text)) {
    commands.push({
      action: "assign_staff",
      assignee_email: emails[0],
      case_ref: ref,
    });
  }

  if (commands.length > 0) return commands;

  if (/\b(pending|queue)\b/.test(lower) && emails.length === 0 && !ref) {
    return [{ action: "summary" }];
  }

  return [];
}
