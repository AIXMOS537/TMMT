#!/usr/bin/env node
/**
 * new-tenant — stands up a white-label client from the template.
 *
 * Usage:
 *   npm run tenant:new -- --id=acme --name="Acme Logistics" \
 *     [--slug=acme] [--tagline="..."] [--primary=#22d3ee] [--accent=#0891b2] \
 *     [--marketing=acmelogistics.com] [--app=acme-portal.vercel.app] \
 *     [--tier=tenant] [--agent=Dispatch] [--support=help@acmelogistics.com]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TENANT_DIR = join(REPO_ROOT, "config", "platform", "tenants");
const TEMPLATE = join(TENANT_DIR, "_template.json");
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = /^--([a-z][a-z0-9-]*)(?:=([\s\S]*))?$/i.exec(arg);
    if (!m) throw new Error(`unrecognized argument: ${arg}`);
    out[m[1].toLowerCase()] = m[2] ?? "true";
  }
  return out;
}

function normalizeHost(host) {
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const id = String(args.id ?? "").trim().toLowerCase();
  const name = String(args.name ?? "").trim();
  if (!id || !name) {
    console.error('usage: npm run tenant:new -- --id=<kebab-case-id> --name="<Display Name>" [options]');
    process.exit(2);
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(id)) {
    throw new Error(`--id must be kebab-case (letters, digits, hyphens): got "${id}"`);
  }
  const slug = String(args.slug ?? id).trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(slug)) {
    throw new Error(`--slug must be lowercase letters, digits, "_" or "-": got "${slug}"`);
  }
  const primary = String(args.primary ?? "#7fffd4").trim();
  const accent = String(args.accent ?? "#6366f1").trim();
  for (const [flag, value] of [["primary", primary], ["accent", accent]]) {
    if (!HEX.test(value)) throw new Error(`--${flag} must be a hex color like #22d3ee: got "${value}"`);
  }
  const outFile = join(TENANT_DIR, `${id}.json`);
  if (existsSync(outFile)) throw new Error(`tenant already exists: config/platform/tenants/${id}.json`);

  const claimed = new Map();
  for (const file of readdirSync(TENANT_DIR)) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    const raw = JSON.parse(readFileSync(join(TENANT_DIR, file), "utf8"));
    for (const key of [raw.slug, ...(raw.aliases ?? [])]) claimed.set(key, file);
    if (raw.id === id) throw new Error(`tenant id "${id}" already used by ${file}`);
  }
  const aliases = [...new Set([id, slug])];
  for (const key of aliases) {
    if (claimed.has(key)) throw new Error(`slug/alias "${key}" is already claimed by ${claimed.get(key)}`);
  }

  const template = JSON.parse(readFileSync(TEMPLATE, "utf8"));
  delete template.$comment;
  const tenant = {
    ...template,
    id,
    slug,
    aliases,
    displayName: name,
    legalName: String(args.legal ?? name),
    tagline: String(args.tagline ?? ""),
    theme: {
      ...template.theme,
      primary,
      accent,
      logoPath: `/brands/${id}/logo.svg`,
      markPath: `/brands/${id}/mark.svg`,
      faviconPath: `/brands/${id}/favicon.svg`,
    },
    domains: {
      ...(args.marketing ? { marketing: normalizeHost(args.marketing) } : {}),
      ...(args.app ? { app: normalizeHost(args.app) } : {}),
    },
    contact: {
      ...template.contact,
      ...(args.support ? { supportEmail: String(args.support) } : {}),
    },
    agent: { ...template.agent, name: String(args.agent ?? template.agent?.name ?? "Riley") },
    whiteLabel: {
      ...template.whiteLabel,
      licenseTier: String(args.tier ?? "tenant"),
    },
  };
  writeFileSync(outFile, `${JSON.stringify(tenant, null, 2)}\n`);
  console.log(`new-tenant: wrote config/platform/tenants/${id}.json`);
  execFileSync(process.execPath, [join(REPO_ROOT, "scripts", "brand-sync.mjs")], { stdio: "inherit" });
  console.log("");
  console.log(`Tenant "${name}" is live in the brand map.`);
  console.log(`  portal brand   : resolves for /lp/${slug}/... and ${slug}.<your-domain>`);
  console.log(`  real logo      : replace public/brands/${id}/logo.svg (never overwritten)`);
}

try {
  main();
} catch (err) {
  console.error(`new-tenant failed: ${err.message}`);
  process.exit(1);
}
