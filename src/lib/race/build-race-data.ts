import type { getDashboardData } from "@/lib/queries";
import type { TrapRaceData, RaceBlocker } from "./types";

type Dashboard = Awaited<ReturnType<typeof getDashboardData>>;

const GHL_BLOCKER_KEYS: { key: string; label: string; tier: "P0" | "P1" }[] = [
  { key: "GHL_WEBHOOK_SECRET", label: "GHL webhook secret", tier: "P0" },
  { key: "NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT", label: "Ops Kit checkout", tier: "P0" },
  { key: "NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT", label: "Command Kit checkout", tier: "P0" },
  { key: "NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE", label: "Dealer bundle checkout", tier: "P0" },
  { key: "NEXT_PUBLIC_GHL_CHECKOUT_97", label: "$97 membership checkout", tier: "P0" },
  { key: "NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL", label: "Upsell pipeline URL", tier: "P0" },
];

function envOk(key: string): boolean {
  const v = process.env[key];
  if (!v || v.trim().length < 8) return false;
  if (v.includes("YOUR_GHL")) return false;
  return v !== "https://app.gohighlevel.com/";
}

export function buildGhlBlockers(): RaceBlocker[] {
  return GHL_BLOCKER_KEYS.filter(({ key }) => !envOk(key)).map(({ key, label, tier }) => ({
    id: key,
    label,
    tier,
  }));
}

/** Owner empire race board — TRAP pathway + $1M/mo finish line */
export function buildOwnerRaceData(dash: Dashboard): TrapRaceData {
  const blockers = buildGhlBlockers();
  const fleetLive = dash.fleet.total > 0;
  const revenueProxy = dash.payments.total * 97; // rough signal until GHL sync

  return {
    goal: {
      label: "Empire finish line",
      targetUsd: 1_000_000,
      currentUsd: Math.min(revenueProxy, 1_000_000),
      fleetTarget: fleetLive ? 1000 : 100,
      fleetCurrent: dash.fleet.total,
      operatorCap: 100,
      operatorActive: Math.min(dash.customers.active, 100),
    },
    phases: [
      { id: "learn", label: "LEARN", emoji: "📚", description: "Academy · fit test · TRAP" },
      { id: "earn", label: "EARN", emoji: "💰", description: "First $50 · share one link" },
      { id: "churn", label: "CHURN", emoji: "🏁", description: "Milestones · dream car fund" },
      { id: "graduate", label: "GRADUATE", emoji: "👑", description: "Best of the best" },
    ],
    racers: [
      {
        id: "empire",
        name: "You · Watchtower",
        phase: blockers.length > 0 ? "learn" : "earn",
        progress: blockers.length > 0 ? 15 : 40,
        earningsUsd: revenueProxy,
        certified: blockers.length === 0,
        tone: blockers.length > 0 ? "warn" : "good",
      },
      {
        id: "operators",
        name: "Student-operators",
        phase: "learn",
        progress: Math.min(100, dash.leads.qualified * 5),
        earningsUsd: 0,
        certified: false,
        tone: "info",
      },
      {
        id: "customers",
        name: "Racers (customers)",
        phase: "earn",
        progress: Math.min(100, dash.customers.active),
        earningsUsd: dash.customers.active * 97,
        certified: false,
        tone: "neutral",
      },
    ],
    milestones: [
      { id: "m1", label: "Money pipeline live", reward: "GHL checkouts wired", done: blockers.length === 0 },
      { id: "m2", label: "First $50 operator win", reward: "Second vertical link", done: false },
      { id: "m3", label: "$100K/mo", reward: "Hire 1–5 EAs", done: revenueProxy >= 100_000 },
      { id: "m4", label: "$1M/mo", reward: "Empire scale · fleet optional", done: revenueProxy >= 1_000_000 },
    ],
    blockers,
    meshOnline: blockers.length < 3,
  };
}

/** Operator view — personal TRAP track */
export function buildOperatorRaceData(opts: {
  name: string;
  pctComplete: number;
  certified: boolean;
  earningsUsd?: number;
}): TrapRaceData {
  const { name, pctComplete, certified, earningsUsd = 0 } = opts;
  let phase: TrapRaceData["racers"][0]["phase"] = "learn";
  if (pctComplete >= 100) phase = certified ? "graduate" : "churn";
  else if (pctComplete >= 50) phase = "earn";

  return {
    goal: {
      label: "Your finish line",
      targetUsd: 50_000,
      currentUsd: earningsUsd,
      fleetTarget: 1,
      fleetCurrent: earningsUsd >= 25_000 ? 1 : 0,
      operatorCap: 1,
      operatorActive: 1,
    },
    phases: [
      { id: "learn", label: "LEARN", emoji: "📚", description: "Academy modules" },
      { id: "earn", label: "EARN", emoji: "💰", description: "First $50" },
      { id: "churn", label: "CHURN", emoji: "🏁", description: "Dream car fund" },
      { id: "graduate", label: "GRADUATE", emoji: "👑", description: "TRAP graduate" },
    ],
    racers: [
      {
        id: "you",
        name,
        phase,
        progress: pctComplete,
        earningsUsd,
        certified,
        tone: certified ? "good" : "info",
      },
    ],
    milestones: [
      { id: "o1", label: "Fit test pass", reward: "Join unlocked", done: pctComplete > 0 },
      { id: "o2", label: "Academy 100%", reward: "Certified", done: pctComplete >= 100 },
      { id: "o3", label: "First $50", reward: "Second link", done: earningsUsd >= 50 },
      { id: "o4", label: "Dream car 25%", reward: "Graduate", done: earningsUsd >= 12_500 },
    ],
    blockers: [],
    meshOnline: true,
  };
}
