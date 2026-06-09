#!/usr/bin/env node
/**
 * Revenue pipeline readiness — GHL env + webhook smoke test.
 * Usage: node scripts/ghl-activation-check.mjs [--test-webhook]
 */
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { loadProjectEnv } from "./load-env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv() {
  loadProjectEnv();
}

loadDotEnv();

const GHL_VARS = [
  { key: "GHL_WEBHOOK_SECRET", tier: "P0", note: "Validates inbound GHL webhooks" },
  {
    key: "NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT",
    tier: "P0",
    note: "/kits — Ops Kit online checkout (GHL funnel URL)",
  },
  {
    key: "NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT",
    tier: "P0",
    note: "/kits — Command Kit online checkout",
  },
  {
    key: "NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE",
    tier: "P0",
    note: "/kits — Dealer bundle checkout",
  },
  {
    key: "NEXT_PUBLIC_GHL_CHECKOUT_97",
    tier: "P0",
    note: "$97/mo membership checkout URL",
  },
  {
    key: "NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL",
    tier: "P0",
    note: "Owner hub upsell queue filter in GHL",
  },
  {
    key: "NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT_USB",
    tier: "P1",
    note: "/kits — Ops Kit + ship USB",
  },
  {
    key: "NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT_USB",
    tier: "P1",
    note: "/kits — Command Kit + ship USB",
  },
  {
    key: "NEXT_PUBLIC_GHL_CREDIT_GUIDANCE",
    tier: "P1",
    note: "Credit guidance checkout / booking",
  },
  {
    key: "NEXT_PUBLIC_GHL_OPERATOR_APPLY",
    tier: "P1",
    note: "Operator application funnel",
  },
  {
    key: "NEXT_PUBLIC_GHL_CHECKOUT_LLC",
    tier: "P1",
    note: "LLC formation checkout",
  },
  {
    key: "NEXT_PUBLIC_GHL_CHECKOUT_3750",
    tier: "P1",
    note: "Operator high-ticket checkout",
  },
  {
    key: "NEXT_PUBLIC_OWNER_HUB_HOST",
    tier: "P0",
    note: "Staff domain (target: tmmtrentals.net)",
  },
];

function isPlaceholder(v) {
  if (!v) return true;
  return v.includes("YOUR_GHL") || v === "https://app.gohighlevel.com/";
}

console.log("=== GHL Revenue Activation Check ===\n");

let blockers = 0;
for (const { key, tier, note } of GHL_VARS) {
  const v = process.env[key];
  const ok = v && !isPlaceholder(v);
  const icon = ok ? "✓" : tier === "P0" ? "✗" : "○";
  if (!ok && tier === "P0") blockers++;
  console.log(`${icon} [${tier}] ${key}`);
  console.log(`    ${note}`);
  if (v && !ok) console.log(`    current: ${v.slice(0, 60)}… (placeholder)`);
  else if (!v) console.log("    current: (empty)");
  console.log();
}

console.log("GHL setup checklist (do in GoHighLevel UI):");
console.log("  1. Create tags: tmmt-customer, rental-completed, ready-for-aixmos, member-97, …");
console.log("  2. Pipeline: TMMT → AIXMOS (11 stages) — see docs/GHL-PIPELINE-SETUP.md");
console.log("  3. Stripe product: $7 trial → $97/mo → paste URL into NEXT_PUBLIC_GHL_CHECKOUT_97");
console.log("  4. Workflow webhook → POST /api/webhooks/ghl (tag + payment events)");
console.log("  5. On ready-for-aixmos → same webhook forwards to /api/webhooks/ghl/program");
console.log("  6. Build GHL sites for tmmtrentals.com + aioms.com before DNS cutover");
console.log();

if (blockers > 0) {
  console.log(`Result: ${blockers} P0 blocker(s). Set vars in Vercel + .env, then redeploy.`);
  process.exit(1);
}

console.log("Result: P0 env vars look configured.");

const testWebhook = process.argv.includes("--test-webhook");
if (!testWebhook) {
  console.log("\nRun with --test-webhook to POST a sample payload to localhost.");
  process.exit(0);
}

const base = process.env.GHL_TEST_BASE_URL ?? "http://localhost:3000";
const secret = process.env.GHL_WEBHOOK_SECRET ?? "";
const payload = {
  email: process.env.GHL_TEST_EMAIL ?? "test@example.com",
  event: "payment_received",
  amount: 97,
  payment_method: "Stripe",
  tags: ["member-97", "ready-for-aixmos"],
  contact_id: "ghl_test_contact",
};

console.log(`\nTesting webhook at ${base}/api/webhooks/ghl …`);
const res = await fetch(`${base}/api/webhooks/ghl`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(secret ? { "x-ghl-webhook-secret": secret } : {}),
  },
  body: JSON.stringify(payload),
});
const text = await res.text();
console.log(`HTTP ${res.status}: ${text.slice(0, 500)}`);
process.exit(res.ok ? 0 : 1);
