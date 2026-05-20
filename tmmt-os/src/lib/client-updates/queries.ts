import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClientRentalHub } from "@/lib/client-rental/queries";
import { clientStatusLabel, clientStatusMessage } from "./messages";
import type { CaseStatus } from "@/lib/workflow/statuses";

export type ClientUpdatesFeed = {
  rental: Awaited<ReturnType<typeof getClientRentalHub>> | null;
  notifications: {
    id: string;
    title: string;
    body: string | null;
    created_at: string;
    case_id: string | null;
    read_at: string | null;
  }[];
  recentTeamMessages: {
    id: string;
    case_id: string | null;
    message: string;
    created_at: string;
    ref_code: string | null;
    subject: string | null;
  }[];
  openTickets: {
    id: string;
    ref_code: string;
    subject: string;
    status: CaseStatus;
    updated_at: string;
  }[];
};

export async function getClientUpdatesFeed(email: string, profileId: string): Promise<ClientUpdatesFeed> {
  const supabase = createSupabaseServerClient();
  const normalized = email.trim();

  const [rental, { data: notifications }, { data: teamMsgs }, { data: tickets }] = await Promise.all([
    getClientRentalHub(normalized).catch(() => null),
    supabase
      .from("notifications")
      .select("id, title, body, created_at, case_id, read_at")
      .eq("recipient", profileId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("case_client_updates")
      .select("id, case_id, message, created_at, cases:case_id ( ref_code, subject )")
      .ilike("customer_email", normalized)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("cases")
      .select("id, ref_code, subject, status, updated_at")
      .ilike("customer_email", normalized)
      .not("status", "in", '("closed","completed")')
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  return {
    rental,
    notifications: notifications ?? [],
    recentTeamMessages: (teamMsgs ?? []).map((m) => {
      const raw = m.cases as { ref_code: string; subject: string } | { ref_code: string; subject: string }[] | null;
      const c = Array.isArray(raw) ? raw[0] : raw;
      return {
        id: m.id,
        case_id: m.case_id,
        message: m.message,
        created_at: m.created_at,
        ref_code: c?.ref_code ?? null,
        subject: c?.subject ?? null,
      };
    }),
    openTickets: (tickets ?? []).map((t) => ({
      id: t.id,
      ref_code: t.ref_code,
      subject: t.subject,
      status: t.status as CaseStatus,
      updated_at: t.updated_at,
    })),
  };
}

export async function getCaseTimelineForClient(caseId: string, email: string) {
  const supabase = createSupabaseServerClient();

  const [{ data: history }, { data: messages }] = await Promise.all([
    supabase
      .from("case_status_history")
      .select("to_status, from_status, created_at, note")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    supabase
      .from("case_client_updates")
      .select("message, created_at")
      .eq("case_id", caseId)
      .ilike("customer_email", email.trim())
      .order("created_at", { ascending: true }),
  ]);

  const statusEvents = (history ?? []).map((h) => ({
    kind: "status" as const,
    at: h.created_at,
    title: clientStatusLabel((h.to_status ?? "intake_submitted") as CaseStatus),
    detail: clientStatusMessage((h.to_status ?? "intake_submitted") as CaseStatus),
    note: h.note,
  }));

  const messageEvents = (messages ?? []).map((m) => ({
    kind: "message" as const,
    at: m.created_at,
    title: "Message from TMMT",
    detail: m.message,
    note: null as string | null,
  }));

  return [...statusEvents, ...messageEvents].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );
}

export { clientStatusLabel, clientStatusMessage };
