#!/usr/bin/env node
/**
 * GHL Voice AI — Bella activation checker.
 * Usage: node scripts/ghl-voice-ai-activate.mjs [--print-prompt]
 */
import { loadProjectEnv } from "./load-env.mjs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

loadProjectEnv();

const VOICE_VARS = [
  { key: "GHL_API_KEY", tier: "P0", note: "GHL API for tags + contact sync mid-call" },
  { key: "GHL_LOCATION_ID", tier: "P0", note: "Rentals / TMMT sub-account" },
  { key: "GHL_VOICE_WEBHOOK_SECRET", tier: "P0", note: "Auth header for /api/agent/voice/ghl" },
  { key: "GHL_WEBHOOK_SECRET", tier: "P0", note: "Existing GHL webhook auth" },
  { key: "ELEVENLABS_API_KEY", tier: "P1", note: "Premium voice (Vapi tier / ARIA fallback)" },
  { key: "ELEVENLABS_VOICE_ID", tier: "P1", note: "Bella voice ID (default Sarah)" },
  { key: "ANTHROPIC_API_KEY", tier: "P0", note: "LLM brain for post-call transcript processing" },
];

const base =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://tmmt-ops.vercel.app";
const webhookUrl = `${base}/api/agent/voice/ghl`;

console.log("\n🎙️  GHL Voice AI — Bella Activation Check\n");
console.log(`Webhook URL: ${webhookUrl}`);
console.log(`Auth header: x-ghl-voice-secret: <GHL_VOICE_WEBHOOK_SECRET>\n`);

let p0missing = 0;
for (const v of VOICE_VARS) {
  const ok = Boolean(process.env[v.key]?.trim());
  const mark = ok ? "✓" : v.tier === "P0" ? "✗" : "○";
  if (!ok && v.tier === "P0") p0missing++;
  console.log(`  ${mark} [${v.tier}] ${v.key} — ${v.note}`);
}

console.log("\n--- GHL Console Checklist (do in order) ---\n");
const steps = [
  "Settings → Phone System → pick TMMT number → Edit → Call Forwarding → Voice AI (1st priority)",
  "Inbound timeout: 1–3 seconds (so Bella answers before voicemail)",
  "AI Agents → Voice AI → Create agent 'Bella — TMMT Concierge'",
  "Agent Goals → Advanced Mode → paste prompt from docs/ghl/VOICE-AI-BELLA-LAUNCH-PACK.md",
  "Voice: pick warm confident female (test 3 options — Sophia / warm US female)",
  "Phone & Availability → backup toggle OFF (AI answers every call immediately)",
  "Deploy tab → assign Bella to TMMT GHL number(s)",
  "Custom Actions → + New Action per action (qualify_lead, book_handoff, escalate_human, tag_vertical)",
  `Webhook URL: ${webhookUrl} | Method POST | Header x-ghl-voice-secret`,
  "GHL Mobile app on work iPhone + personal iPhone (LC Phone) — humans can transfer from Bella",
  "MacBooks: GHL web dialer or softphone — same numbers, transfer to human when hot",
  "Test: call the number → Bella answers → say 'I need a rental this weekend' → verify GHL tags",
];
steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

if (process.argv.includes("--print-prompt")) {
  const promptPath = join(
    root,
    "src/lib/agent/persona/bella-voice.ts"
  );
  if (existsSync(promptPath)) {
    const raw = readFileSync(promptPath, "utf8");
    const m = raw.match(/export const GHL_VOICE_AGENT_PROMPT = `([\s\S]*?)`;/);
    if (m) {
      console.log("\n--- COPY INTO GHL VOICE AI AGENT GOALS ---\n");
      console.log(m[1]);
    }
  }
}

console.log("\n--- Device Matrix ---\n");
console.log("  Work iPhone    → GHL app + LC Phone (takeover / warm transfer from Bella)");
console.log("  Personal iPhone→ same GHL app login OR forward to work line");
console.log("  Carry M5       → GHL web + approve handoffs via Rick");
console.log("  M1 Rick        → GHL web dialer + closer scripts in ~/Sync/rick/SALES-SCRIPTS/");
console.log("  Bella (AI)     → answers FIRST on all GHL numbers (primary mode)\n");

if (p0missing > 0) {
  console.log(`⚠️  ${p0missing} P0 env var(s) missing — add to .env + Vercel before go-live.\n`);
  process.exit(1);
}

console.log("✓ P0 env ready. Wire GHL console steps above, then test-call.\n");
