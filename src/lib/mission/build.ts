import type { getDashboardData } from "@/lib/queries";
import type { MissionBoardData, Tone } from "./types";

type Dashboard = Awaited<ReturnType<typeof getDashboardData>>;

/**
 * Derive the owner "Your Mission Now" board from live dashboard metrics.
 * Stats and the "what you're needed for" list are data-driven; agents and
 * grow-moves are curated copy for now (no live agent telemetry yet).
 */
export function buildOwnerMissionData(
  dash: Dashboard,
  greetingName = "Owner",
): MissionBoardData {
  const overdue = dash.payments.overdue;
  const openTickets = dash.tickets.open;
  const pendingChecks = dash.bgChecks.pending;
  const newLeads = dash.leads.new;

  // Things that need a human decision, surfaced only when the count is non-zero.
  const neededFor: MissionBoardData["neededFor"] = [];
  if (overdue > 0) {
    neededFor.push({
      icon: "💸",
      title: `${overdue} overdue payment${overdue === 1 ? "" : "s"}`,
      detail: "Review and follow up on past-due balances.",
      agent: "bob",
    });
  }
  if (openTickets > 0) {
    neededFor.push({
      icon: "🎫",
      title: `${openTickets} open ticket${openTickets === 1 ? "" : "s"}`,
      detail: "Triage support and violation tickets awaiting action.",
      agent: "sticks",
    });
  }
  if (pendingChecks > 0) {
    neededFor.push({
      icon: "🛡️",
      title: `${pendingChecks} background check${pendingChecks === 1 ? "" : "s"} pending`,
      detail: "Approve or reject applicants stuck in review.",
      agent: "tank",
    });
  }
  if (newLeads > 0) {
    neededFor.push({
      icon: "📥",
      title: `${newLeads} new lead${newLeads === 1 ? "" : "s"}`,
      detail: "Qualify fresh inbound before they go cold.",
      agent: "fly_guy",
    });
  }
  if (neededFor.length === 0) {
    neededFor.push({
      icon: "✅",
      title: "All clear",
      detail: "No payments, tickets, checks, or leads need you right now.",
    });
  }

  const overdueTone: Tone = overdue > 0 ? "alert" : "good";
  const ticketTone: Tone = openTickets > 0 ? "warn" : "good";
  const checkTone: Tone = pendingChecks > 0 ? "warn" : "neutral";

  return {
    view: "owner",
    greetingName,
    stats: [
      { label: "Fleet vehicles", value: dash.fleet.total, tone: "neutral" },
      { label: "Available now", value: dash.fleet.available, tone: "good" },
      { label: "Rented out", value: dash.fleet.rented, tone: "info" },
      { label: "Under maintenance", value: dash.fleet.maintenance, tone: dash.fleet.maintenance > 0 ? "warn" : "neutral" },
      { label: "Active customers", value: dash.customers.active, tone: "good" },
      { label: "New leads", value: newLeads, tone: newLeads > 0 ? "info" : "neutral" },
      { label: "Open tickets", value: openTickets, tone: ticketTone },
      { label: "Overdue payments", value: overdue, tone: overdueTone },
    ],
    neededFor,
    growMoves: [
      { icon: "🚗", title: "Grow the fleet", detail: "Add vehicles where demand outpaces availability." },
      { icon: "📣", title: "Reactivate the waitlist", detail: `${dash.waitlist} on the waitlist — convert them as cars free up.` },
      { icon: "🤝", title: "Lean on affiliates", detail: "Push the affiliate program to drive qualified referrals." },
    ],
    // Every row here reports a real number off the dashboard. "Vision —
    // Watching KPIs" used to sit at the top of this list with nothing behind
    // it: a fixed string under a heading that reads "AIXMOS agents — on watch".
    // The other four are a themed presentation of live counts, which is fine;
    // that one was the panel telling you something was being watched when
    // nothing was. Put it back when it has a number to report.
    agents: [
      { key: "tank", label: "Tank", role: "Risk & checks", status: pendingChecks > 0 ? `${pendingChecks} to review` : "Clear", tone: checkTone },
      { key: "fly_guy", label: "Fly Guy", role: "Leads", status: newLeads > 0 ? `${newLeads} new` : "Quiet", tone: newLeads > 0 ? "info" : "neutral" },
      { key: "bob", label: "Bob", role: "Billing", status: overdue > 0 ? `${overdue} overdue` : "All paid", tone: overdueTone },
      { key: "sticks", label: "Sticks", role: "Support", status: openTickets > 0 ? `${openTickets} open` : "Clear", tone: ticketTone },
    ],
  };
}
