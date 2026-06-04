#!/usr/bin/env node
/**
 * Send a test dispatch job to TMMT OS API.
 * Usage: node scripts/ghl-dispatch/send-test-dispatch.mjs
 */
import { loadEnvLocal, ROOT } from "./load-env.mjs";

loadEnvLocal();

const secret =
  process.env.JOB_DISPATCH_SECRET?.trim() ||
  process.env.OPS_COMMAND_SECRET?.trim();

const base = (process.env.NEXT_PUBLIC_PORTAL_URL || "http://localhost:3000").replace(/\/$/, "");
const url = `${base}/api/jobs/dispatch`;

const body = {
  vendor_company: "Codex Test Auto Shop",
  vendor_contact_email: process.env.TEST_DISPATCH_EMAIL || "dispatch-test@tmmt.test",
  vendor_contact_name: "Test Contact",
  work_type: "dispatch_full",
  subject: "Codex test dispatch — ignore",
  details: "Automated test from scripts/ghl-dispatch/send-test-dispatch.mjs",
  pickup: "123 Test Pickup St, Los Angeles, CA",
  dropoff: "456 Test Dropoff Ave, Irvine, CA",
  offered_price: 199,
};

async function main() {
  const headers = { "Content-Type": "application/json" };
  if (secret) headers.Authorization = `Bearer ${secret}`;

  console.log("POST", url);
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log("Status:", res.status);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
