/**
 * The module catalogue — the single source of truth for what we tell the
 * public we can deliver.
 *
 * Every entry here becomes a public claim on /configurator, so the shape of
 * this file is built around one rule: a module may only be marked REAL if
 * there is something on this machine or in this database that proves it.
 * `evidence` is not documentation, it is the receipt, and a test asserts
 * every REAL carries one.
 *
 * Two things a reader of this file needs to know, because both are easy to
 * get wrong and expensive when you do:
 *
 * 1. REAL means "has carried real traffic", not "the code exists". Code that
 *    has never run is COMING. The clearest case is `text-your-assistant`:
 *    five well-built files, a full state machine, and `agent_messages` = 0
 *    rows. It has never processed one message. Shipping that as REAL is the
 *    most exposed claim we could make, so it is COMING until it has run.
 *
 * 2. `entitlement` is the licence module id that would actually switch this
 *    on — and for most of the catalogue it is deliberately `null`, because
 *    no such id exists yet. See ENTITLEMENT_IDS below before you fill one in.
 */

export const MODULE_LAYERS = ["machine", "brain", "surface"] as const;
export type ModuleLayer = (typeof MODULE_LAYERS)[number];

export const MODULE_LAYER_LABEL: Record<ModuleLayer, string> = {
  machine: "The machine",
  brain: "The brain",
  surface: "The surface",
};

export const MODULE_LAYER_BLURB: Record<ModuleLayer, string> = {
  machine: "Where your system runs, and how you keep it if we vanish.",
  brain: "What it knows, what it decides, and what it is not allowed to do.",
  surface: "The parts your customers actually touch.",
};

/**
 * REAL   — running today, and we can show you.
 * COMING — built or being built, not yet proven in production. Say so.
 */
export type ModuleStatus = "real" | "coming";

/**
 * The licence module ids that genuinely exist in organization_licenses.modules
 * today, read from the live database on 2026-09-14:
 *
 *   agent_sales · credit_repair · dispatch_core · lease_to_own
 *   operator_program · partner_deploy · rentals_app · revenue_engine
 *
 * This list is narrow on purpose. It is the difference between a catalogue
 * entry that maps to something the system can grant and one that only maps to
 * a sentence on a page. A test refuses any id outside this set, so nobody can
 * quietly invent an entitlement that no licence will ever carry.
 *
 * ⚠️ Worth knowing before you read too much into any of this: guardOrganization()
 * in src/lib/agent/guard.ts reads `active` and `kill_command` and NOTHING ELSE.
 * No code path anywhere reads `modules[]`. Today the column records intent, it
 * does not enforce access. Which is exactly why the configurator is a scoping
 * tool and not a switch — picking a module here has never turned anything on,
 * and this file must not imply that it does.
 */
export const ENTITLEMENT_IDS = [
  "agent_sales",
  "credit_repair",
  "dispatch_core",
  "lease_to_own",
  "operator_program",
  "partner_deploy",
  "rentals_app",
  "revenue_engine",
] as const;
export type EntitlementId = (typeof ENTITLEMENT_IDS)[number];

export type ModuleEntry = {
  id: string;
  layer: ModuleLayer;
  /** Plain name. 5th-grade reading level, no internal codenames. */
  name: string;
  /** One sentence a stranger understands. */
  summary: string;
  status: ModuleStatus;
  /** Why we are allowed to say that. Required for every REAL. */
  evidence: string;
  /** The licence module that would grant this, when one exists. */
  entitlement: EntitlementId | null;
};

export const MODULE_CATALOG: readonly ModuleEntry[] = [
  // ---------------------------------------------------------------- machine
  {
    id: "own-box",
    layer: "machine",
    name: "Your own box",
    summary: "The system runs on a machine you own, in your building, not a rented account.",
    status: "real",
    evidence:
      "Physical machines are running this today. They live outside this repository, which is why a code search finds little — that is a measurement artefact, not an absence.",
    entitlement: null,
  },
  {
    id: "own-stack-install",
    layer: "machine",
    name: "We install the whole stack",
    summary: "We set it up end to end so you are not assembling software.",
    status: "real",
    evidence:
      "18 provisioning files in this repository, plus a USB provisioner that has booted real firmware.",
    entitlement: "partner_deploy",
  },
  {
    id: "recovery-drive",
    layer: "machine",
    name: "A drive that brings it all back",
    summary: "If the machine dies, you plug in one drive and you are running again.",
    status: "real",
    evidence: "Built and verified. Boot proven on real hardware, not in a simulator.",
    entitlement: null,
  },
  {
    id: "team-rollout",
    layer: "machine",
    name: "Roll it out to your team",
    summary: "Logins, roles and training for everyone who works for you.",
    status: "coming",
    evidence:
      "Three user accounts exist in total and all three are staff. Nobody has ever rolled this out to a team. Building it for one person is not the same thing.",
    entitlement: null,
  },

  // ------------------------------------------------------------------ brain
  {
    id: "approval-gate",
    layer: "brain",
    name: "Nothing goes out without a person",
    summary: "Anything promotional waits for a human to approve it before it sends.",
    status: "real",
    evidence:
      "13 files, and it is enforced structurally: the build fails if somebody adds a new way to send that skips the gate.",
    entitlement: null,
  },
  {
    id: "private-ai",
    layer: "brain",
    name: "AI that stays in the building",
    summary: "The models run on your machine. Your business text does not leave it.",
    status: "real",
    evidence:
      "16 models answering on local hardware today at roughly 50 words a second. Outside this repository, hence no code hits.",
    entitlement: null,
  },
  {
    id: "business-memory",
    layer: "brain",
    name: "It remembers your business",
    summary: "Ask it about your own documents and past work, and it answers from them.",
    status: "real",
    evidence:
      "The search index is running and answering against a compiled document corpus. Confirmed live, outside this repository.",
    entitlement: null,
  },
  {
    id: "owner-pulse",
    layer: "brain",
    name: "You can see what it did",
    summary: "Every action it takes is written down where you can read it.",
    status: "real",
    evidence: "3,891 recorded events in the live database. The record is genuinely being written.",
    entitlement: null,
  },
  {
    id: "text-your-assistant",
    layer: "brain",
    name: "Text your assistant",
    summary: "Send it a message like you would a person, and it answers and books.",
    // 🔴 The contested one. Code quality is not the question; traffic is.
    status: "coming",
    evidence:
      "The code is real — five files and a full conversation state machine. It has also never processed a single message: zero conversations and zero messages in the live database. Carrier registration for business texting is not complete either, so it cannot legally carry cold traffic yet.",
    entitlement: "agent_sales",
  },

  // ---------------------------------------------------------------- surface
  {
    id: "website-forms",
    layer: "surface",
    name: "Website and intake forms",
    summary: "A site that captures the people who land on it.",
    status: "real",
    evidence: "60 files, and 883 real leads captured through it in production.",
    entitlement: null,
  },
  {
    id: "booking",
    layer: "surface",
    name: "Online booking",
    summary: "People pick a time and it lands on your calendar.",
    status: "real",
    evidence: "35 files. Signed webhook with replay protection, so a booking cannot be faked or replayed.",
    entitlement: null,
  },
  {
    id: "compliant-texting",
    layer: "surface",
    name: "Texting that will not get you in trouble",
    summary:
      "It refuses to text anyone who said stop, and it will not text late at night.",
    status: "real",
    evidence:
      "11 files. Quiet hours are enforced in the recipient's own time zone, and the block list is checked on every send. The product here is the refusal, not the volume — we have not sent at scale and do not claim to.",
    entitlement: null,
  },
  {
    id: "content-packs",
    layer: "surface",
    name: "Posts written for you",
    summary: "A steady queue of things to publish, drafted and waiting for your yes.",
    status: "real",
    evidence: "Nine drafting roles run daily with roughly 100 posts staged. Outside this repository.",
    entitlement: null,
  },
  {
    id: "ai-receptionist",
    layer: "surface",
    name: "An assistant that answers the phone",
    summary: "Picks up, answers the usual questions, and books the caller in.",
    status: "coming",
    evidence:
      "Built — the handler, five actions and the webhook all exist. It is switched off: production reports a missing secret and there is no public number yet. Ready, not yet on.",
    entitlement: "agent_sales",
  },
  {
    id: "client-portal",
    layer: "surface",
    name: "Your client watches it get built",
    summary: "Your customer sees the stage, the dates, and can ask for changes in one place.",
    status: "coming",
    evidence:
      "Built and tested on a branch, not yet merged and its database change is not yet applied. Two owner steps from real.",
    entitlement: null,
  },
];

export function modulesInLayer(layer: ModuleLayer): ModuleEntry[] {
  return MODULE_CATALOG.filter((m) => m.layer === layer);
}

export function moduleById(id: string): ModuleEntry | undefined {
  return MODULE_CATALOG.find((m) => m.id === id);
}

/**
 * Resolve a list of ids the visitor picked. Unknown ids are dropped rather
 * than rendered, because the ids arrive from the query string — a stranger
 * can put anything in there and it must never reach the page.
 */
export function resolveSelection(ids: readonly string[]): ModuleEntry[] {
  const seen = new Set<string>();
  const out: ModuleEntry[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const m = moduleById(id);
    if (!m) continue;
    seen.add(id);
    out.push(m);
  }
  return out;
}

/**
 * What a selection actually means, split the way a buyer needs to hear it.
 * `coming` is never folded into `real` — the split IS the product.
 */
export function describeSelection(ids: readonly string[]): {
  real: ModuleEntry[];
  coming: ModuleEntry[];
  total: number;
} {
  const picked = resolveSelection(ids);
  return {
    real: picked.filter((m) => m.status === "real"),
    coming: picked.filter((m) => m.status === "coming"),
    total: picked.length,
  };
}
