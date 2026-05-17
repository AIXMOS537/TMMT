#!/usr/bin/env node
/**
 * Verifies TMMT OS Supabase schema is applied (cases table exists).
 * Usage: node scripts/check-db.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

function loadEnv() {
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i);
      const v = t.slice(i + 1);
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or keys in .env.local");
  process.exit(1);
}

const res = await fetch(`${url}/rest/v1/cases?select=id&limit=1`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});

if (res.status === 200) {
  const rows = await res.json();
  console.log("OK: public.cases exists", rows.length ? "(has rows)" : "(empty)");
  process.exit(0);
}

if (res.status === 404) {
  console.error(
    "MISSING: TMMT OS schema not applied.\n" +
      "  1. Open https://supabase.com/dashboard/project/uapxakmlwnpfsftfeezx/sql/new\n" +
      "  2. Paste supabase/migrations/0001_init.sql and Run\n" +
      "  Or: SUPABASE_DB_URL='postgresql://...' python3 scripts/apply-migration.py",
  );
  process.exit(1);
}

console.error("Unexpected:", res.status, await res.text());
process.exit(1);
