#!/usr/bin/env node
/**
 * Provision Bella Voice AI agent in GHL via Public API.
 * Idempotent: finds existing "Bella" agent or creates one, syncs actions + prompt.
 *
 * Usage: node scripts/ghl-voice-ai-provision.mjs [--dry-run]
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { loadProjectEnv } from "./load-env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");

loadProjectEnv();

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_KEY = process.env.GHL_API_KEY?.trim();
const LOCATION_ID =
  process.env.GHL_LOCATION_ID?.trim() || "Xcd8DZt5T4GWnBtBEC5V";
const VOICE_SECRET = process.env.GHL_VOICE_WEBHOOK_SECRET?.trim();
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://tmmt-ops.vercel.app";
const WEBHOOK_URL = `${APP_URL}/api/agent/voice/ghl`;

function ghlHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    Version: "2021-07-28",
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function loadBellaPrompt() {
  const p = join(root, "src/lib/agent/persona/bella-voice.ts");
  const raw = readFileSync(p, "utf8");
  const m = raw.match(/export const GHL_VOICE_AGENT_PROMPT = `([\s\S]*?)`;/);
  if (!m) throw new Error("Could not parse GHL_VOICE_AGENT_PROMPT");
  return m[1];
}

function actionBody(action, vertical = "rentals") {
  return JSON.stringify({
    action,
    phone: "{{contact.phone}}",
    contact_id: "{{contact.id}}",
    vertical,
    transcript_snippet: "{{last_user_message}}",
    caller_name: "{{contact.first_name}}",
    appointment_time: "{{appointment_time}}",
    org_slug: "tmmt-rentals",
  });
}

const CUSTOM_ACTIONS = [
  {
    name: "Bella — Tag Vertical",
    triggerPrompt:
      "As soon as you know what they need: rental, detailing, credit, funding, or moving",
    triggerMessage: "Got it, let me note that for the team.",
    body: actionBody("tag_vertical"),
  },
  {
    name: "Bella — Qualify Lead",
    triggerPrompt:
      "When you know their vertical, timeline, and they show real interest",
    triggerMessage: "Perfect, I'm locking that in on my end.",
    body: actionBody("qualify_lead"),
  },
  {
    name: "Bella — Book Handoff",
    triggerPrompt: "When they pick a time or say book me, lock it in, or yes to appointment",
    triggerMessage: "Amazing — I'm getting you booked right now.",
    body: actionBody("book_handoff"),
  },
  {
    name: "Bella — Escalate Human",
    triggerPrompt:
      "When they insist on a person, are angry, ask legal/compliance questions, or high ticket",
    triggerMessage: "Let me get someone from the team for you — one moment.",
    body: actionBody("escalate_lead").replace("escalate_lead", "escalate_human"),
  },
];

// fix escalate action name
CUSTOM_ACTIONS[3].body = actionBody("escalate_human");

function buildCustomActionParams(cfg) {
  const parsed = JSON.parse(cfg.body);
  return {
    triggerPrompt: cfg.triggerPrompt,
    triggerMessage: cfg.triggerMessage,
    apiDetails: {
      url: WEBHOOK_URL,
      method: "POST",
      authenticationRequired: true,
      authenticationValue: VOICE_SECRET,
      headers: [
        { key: "x-ghl-voice-secret", value: VOICE_SECRET },
        { key: "Content-Type", value: "application/json" },
      ],
      parameters: Object.entries(parsed).map(([name, example]) => ({
        name,
        description: `TMMT voice webhook field: ${name}`,
        type: "string",
        example: String(example),
      })),
      selectedPaths: [],
    },
  };
}

async function ghlFetch(path, opts = {}) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    ...opts,
    headers: { ...ghlHeaders(), ...(opts.headers || {}) },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`GHL ${opts.method || "GET"} ${path} → ${res.status}`);
    err.body = json;
    throw err;
  }
  return json;
}

async function listAgents() {
  const q = new URLSearchParams({ locationId: LOCATION_ID, pageSize: "50" });
  const data = await ghlFetch(`/voice-ai/agents?${q}`);
  return data.agents ?? [];
}

async function listVoices() {
  try {
    const q = new URLSearchParams({ locationId: LOCATION_ID });
    const data = await ghlFetch(`/voice-ai/voices?${q}`);
    return data.voices ?? data ?? [];
  } catch {
    return [];
  }
}

async function pickVoiceId() {
  const voices = await listVoices();
  if (!Array.isArray(voices) || voices.length === 0) {
    console.warn("  ! Could not list voices — API may require manual voiceId");
    return null;
  }
  const prefer = voices.find(
    (v) =>
      /female|woman|sophia|bella|rachel|warm/i.test(
        `${v.name || ""} ${v.label || ""} ${v.gender || ""}`
      )
  );
  return (prefer || voices[0])?.id ?? voices[0]?.voiceId ?? null;
}

async function createAgent(prompt, voiceId) {
  const body = {
    locationId: LOCATION_ID,
    agentName: "Bella — TMMT Concierge",
    businessName: "TMMT",
    welcomeMessage:
      "Hey there — this is Bella with TMMT. Just so you know, I'm the concierge assistant and I'll get you booked with our team. What can I help you with today?",
    agentPrompt: prompt,
    voiceId: voiceId || "default",
    language: "en-US",
    patienceLevel: "medium",
    maxCallDuration: 600,
    sendUserIdleReminders: true,
    reminderAfterIdleTimeSeconds: 8,
    timezone: "America/New_York",
    isAgentAsBackupDisabled: true,
    sendPostCallNotificationTo: {
      admins: true,
      allUsers: false,
      contactAssignedUser: true,
      specificUsers: [],
      customEmails: [],
    },
    actions: CUSTOM_ACTIONS.map((cfg) => ({
      actionType: "CUSTOM_ACTION",
      name: cfg.name,
      actionParameters: buildCustomActionParams(cfg),
    })),
  };

  if (DRY) {
    console.log("\n[DRY RUN] Would POST /voice-ai/agents\n", JSON.stringify(body, null, 2).slice(0, 2000));
    return { id: "dry-run" };
  }

  return ghlFetch("/voice-ai/agents", { method: "POST", body: JSON.stringify(body) });
}

async function updateAgent(agentId, prompt, voiceId) {
  const body = {
    agentName: "Bella — TMMT Concierge",
    agentPrompt: prompt,
    isAgentAsBackupDisabled: true,
    welcomeMessage:
      "Hey there — this is Bella with TMMT. Just so you know, I'm the concierge assistant and I'll get you booked with our team. What can I help you with today?",
    ...(voiceId ? { voiceId } : {}),
    actions: CUSTOM_ACTIONS.map((cfg) => ({
      actionType: "CUSTOM_ACTION",
      name: cfg.name,
      actionParameters: buildCustomActionParams(cfg),
    })),
  };

  if (DRY) {
    console.log(`\n[DRY RUN] Would PUT /voice-ai/agents/${agentId}\n`);
    return { id: agentId };
  }

  return ghlFetch(`/voice-ai/agents/${agentId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

async function main() {
  console.log("\n🎙️  GHL Voice AI — Bella Provisioner\n");

  if (!API_KEY || API_KEY.length < 20) {
    console.error("✗ GHL_API_KEY missing or placeholder — cannot provision via API.");
    console.error("  Set in .env.local (Private Integration Token from GHL → Settings → API)");
    console.error("  Then re-run: node scripts/ghl-voice-ai-provision.mjs\n");
    process.exit(2);
  }

  if (!VOICE_SECRET || VOICE_SECRET.length < 20) {
    console.error("✗ GHL_VOICE_WEBHOOK_SECRET missing — run ghl-voice-ai-go.sh first");
    process.exit(2);
  }

  console.log(`  Location: ${LOCATION_ID}`);
  console.log(`  Webhook:  ${WEBHOOK_URL}\n`);

  const prompt = loadBellaPrompt();
  const agents = await listAgents();
  const existing = agents.find((a) =>
    /bella/i.test(a.agentName || "")
  );

  const voiceId = await pickVoiceId();
  if (voiceId) console.log(`  Voice:    ${voiceId}`);

  let agent;
  if (existing?.id) {
    console.log(`  Found existing agent: ${existing.id} (${existing.agentName})`);
    agent = await updateAgent(existing.id, prompt, voiceId);
    console.log("  ✓ Updated Bella agent + custom actions");
  } else {
    console.log("  Creating new Bella agent…");
    agent = await createAgent(prompt, voiceId);
    console.log(`  ✓ Created agent: ${agent.id || agent.agent?.id || "(check GHL UI)"}`);
  }

  console.log("\n  Manual step (GHL UI — phone routing):");
  console.log("  Settings → Phone System → number → Call Forwarding → Voice AI (1st)");
  console.log("  Timeout 1-3s · Deploy tab → assign Bella to number\n");
}

main().catch((e) => {
  console.error("✗ Provision failed:", e.message);
  if (e.body) console.error(JSON.stringify(e.body, null, 2).slice(0, 800));
  process.exit(1);
});
