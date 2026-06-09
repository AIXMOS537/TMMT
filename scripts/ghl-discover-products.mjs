#!/usr/bin/env node
/**
 * List GHL products + suggest .env var mapping for checkout URLs.
 * Paste printed payment-link URLs from GHL UI into .env after running this.
 *
 * Usage: node scripts/ghl-discover-products.mjs
 */
import { loadProjectEnv } from "./load-env.mjs";

const ENV_MAP = [
  { match: /ops kit|ops-001|tmmt ops/i, key: "NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT" },
  { match: /command kit|cmd-001|tmmt command/i, key: "NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT" },
  { match: /dealer bundle|dlr-bnd|dealer bundle/i, key: "NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE" },
  { match: /\$97|97\/mo|membership|growth|aixmos member/i, key: "NEXT_PUBLIC_GHL_CHECKOUT_97" },
  { match: /3750|base infrastructure|base build/i, key: "NEXT_PUBLIC_GHL_CHECKOUT_3750" },
  { match: /7500|enterprise/i, key: "NEXT_PUBLIC_GHL_CHECKOUT_7500" },
  { match: /15000|carbox|car rental in a box/i, key: "NEXT_PUBLIC_GHL_CHECKOUT_15000" },
  { match: /25000|e-?commerce ecosystem/i, key: "NEXT_PUBLIC_GHL_CHECKOUT_25000" },
  { match: /credit guidance/i, key: "NEXT_PUBLIC_GHL_CREDIT_GUIDANCE" },
  { match: /operator apply|become an operator/i, key: "NEXT_PUBLIC_GHL_OPERATOR_APPLY" },
];

if (!loadProjectEnv()) process.exit(1);

const { GHL_API_KEY, GHL_LOCATION_ID } = process.env;
if (!GHL_API_KEY || !GHL_LOCATION_ID) {
  console.error("Need GHL_API_KEY and GHL_LOCATION_ID in .env.local");
  process.exit(1);
}

const res = await fetch(
  `https://services.leadconnectorhq.com/products/?locationId=${GHL_LOCATION_ID}&limit=100`,
  {
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      Version: "2021-07-28",
    },
  }
);

if (!res.ok) {
  console.error(`GHL API ${res.status}:`, (await res.text()).slice(0, 400));
  process.exit(1);
}

const { products = [] } = await res.json();
const fleet = /ford|kia|toyota|camry|prius|rio|focus|plate|vehicle|rental car/i;
const catalog = products.filter((p) => !fleet.test(p.name || ""));

console.log("=== GHL products (non-fleet) ===\n");
if (!catalog.length) {
  console.log("No kit/membership products found — create them in GHL → Payments → Products.");
  console.log("See docs/SALES-CHANNELS.md\n");
} else {
  for (const p of catalog) {
    const hint = ENV_MAP.find((m) => m.match.test(p.name || ""))?.key ?? "(manual map)";
    console.log(`• ${p.name}`);
    console.log(`  slug: ${p.slug}`);
    console.log(`  → suggest env: ${hint}`);
    console.log("");
  }
}

console.log("Next: GHL → Payments → Links → copy each hosted URL into .env");
console.log("Then: npm run ghl:check && npm run ghl:sync-vercel");
