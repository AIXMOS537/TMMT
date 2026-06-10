#!/usr/bin/env node
/**
 * Send test payloads to GHL webhook endpoints.
 * Usage:
 *   node scripts/test-ghl-webhook.mjs tag
 *   node scripts/test-ghl-webhook.mjs program
 *   node scripts/test-ghl-webhook.mjs payment
 */
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { loadProjectEnv } from "./load-env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv() {
  loadProjectEnv();
}

loadDotEnv();

const mode = process.argv[2] ?? "tag";
const base = process.env.GHL_TEST_BASE_URL ?? process.argv[3] ?? "https://tmmt-ops.vercel.app";
const secret = process.env.GHL_WEBHOOK_SECRET ?? "";
const email = process.env.GHL_TEST_EMAIL ?? "test@example.com";

const payloads = {
  tag: {
    path: "/api/webhooks/ghl",
    body: {
      email,
      event: "tag_added",
      tags: ["rental-completed", "tmmt-customer"],
      contact_id: "ghl_test_001",
    },
  },
  program: {
    path: "/api/webhooks/ghl/program",
    body: {
      email,
      first_name: "Test",
      last_name: "Client",
      event: "aixmos.program.start",
      tags: ["ready-for-aixmos"],
      contact_id: "ghl_test_002",
    },
  },
  payment: {
    path: "/api/webhooks/ghl",
    body: {
      email,
      event: "payment_received",
      amount: 97,
      payment_method: "Stripe",
      product: "AIXMOS Membership",
      tags: ["member-97"],
      contact_id: "ghl_test_003",
    },
  },
};

const spec = payloads[mode];
if (!spec) {
  console.error("Mode must be: tag | program | payment");
  process.exit(1);
}

console.log(`POST ${base}${spec.path} (${mode})`);
const res = await fetch(`${base}${spec.path}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(secret ? { "x-ghl-webhook-secret": secret } : {}),
  },
  body: JSON.stringify(spec.body),
});
const text = await res.text();
console.log(`HTTP ${res.status}\n${text}`);
