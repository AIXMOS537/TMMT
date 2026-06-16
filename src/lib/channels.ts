import "server-only";

import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Communication channel topology (see migration 20260616400000_comm_channels).
 * One registry that says what each number is for and how it may be contacted:
 *   GHL  → campaigns/ads/leads · Quo → support + vendor-internal ·
 *   work cell → owner assistant (escalation, working hours) ·
 *   personal → DO NOT CONTACT.
 */

export interface CommChannel {
  id: string;
  label: string;
  provider: "ghl" | "quo" | "work_cell" | "personal" | "other";
  phone: string | null;
  purpose: string | null;
  direction: "inbound" | "outbound" | "both";
  policy: "normal" | "do_not_contact" | "escalation_only";
  working_hours: WorkingHours;
  priority: number;
  active: boolean;
}

export interface WorkingHours {
  tz?: string;
  days?: number[]; // ISO weekday Mon=1..Sun=7
  start?: string; // 'HH:MM'
  end?: string; // 'HH:MM'
}

/** Local phone canonicalizer (kept here to avoid import cycles). */
export function canonicalPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const t = String(raw).trim();
  if (t.startsWith("+")) return "+" + t.slice(1).replace(/\D/g, "");
  const d = t.replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d.startsWith("1")) return "+" + d;
  return d ? "+" + d : "";
}

export async function getChannels(): Promise<CommChannel[]> {
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from("comm_channels")
      .select("*")
      .eq("active", true);
    return (data as CommChannel[]) ?? [];
  } catch {
    return [];
  }
}

/**
 * True if the number is registered with a do_not_contact policy. Outbound
 * automation MUST consult this before texting/calling any number — it's how the
 * personal line (571-351-9690) stays silent.
 */
export async function isDoNotContact(phone: string): Promise<boolean> {
  const target = canonicalPhone(phone);
  if (!target) return false;
  const channels = await getChannels();
  return channels.some(
    (c) => c.policy === "do_not_contact" && canonicalPhone(c.phone) === target
  );
}

/** The owner-escalation channel (the work cell): highest-priority escalation line. */
export async function getEscalationChannel(): Promise<CommChannel | null> {
  const channels = await getChannels();
  const candidates = channels
    .filter(
      (c) =>
        c.phone &&
        (c.provider === "work_cell" || c.policy === "escalation_only") &&
        c.policy !== "do_not_contact"
    )
    .sort((a, b) => b.priority - a.priority);
  return candidates[0] ?? null;
}

/** Is "now" inside this channel's working hours? Empty hours = always allowed. */
export function isWithinWorkingHours(wh: WorkingHours | null | undefined): boolean {
  if (!wh || !wh.start || !wh.end) return true;
  const tz = wh.tz || "America/New_York";
  const days = Array.isArray(wh.days) && wh.days.length ? wh.days : [1, 2, 3, 4, 5, 6, 7];
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date());
    const wdName = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const wd = map[wdName] ?? 0;
    if (!days.includes(wd)) return false;
    const cur = hour * 60 + minute;
    const [sh, sm] = wh.start.split(":").map(Number);
    const [eh, em] = wh.end.split(":").map(Number);
    return cur >= sh * 60 + sm && cur <= eh * 60 + em;
  } catch {
    return true;
  }
}
