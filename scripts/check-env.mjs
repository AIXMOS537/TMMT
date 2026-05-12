#!/usr/bin/env node
/**
 * Validates required env vars and checks reachability of Supabase Auth (no secrets printed).
 */
import { readFileSync, existsSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const envPath = join(root, ".env")

function loadDotEnv() {
  if (!existsSync(envPath)) {
    console.error("Missing .env at project root. Copy values from README / Supabase dashboard.")
    process.exit(1)
  }
  const raw = readFileSync(envPath, "utf8")
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = val
    }
  }
}

function requireNonEmpty(name) {
  const v = process.env[name]
  if (v === undefined || v === null || String(v).trim() === "") {
    console.error(`Missing or empty: ${name}`)
    return false
  }
  return true
}

loadDotEnv()

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]

let ok = required.every(requireNonEmpty)
if (!ok) {
  console.error("\nFix .env and re-run: npm run check-env")
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")
try {
  const u = new URL(url)
  if (u.protocol !== "https:") {
    console.error("NEXT_PUBLIC_SUPABASE_URL must be https")
    ok = false
  }
} catch {
  console.error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL")
  ok = false
}

if (!ok) process.exit(1)

const healthUrl = `${url}/auth/v1/health`
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
console.log(`Checking Supabase Auth reachability (${new URL(url).host})…`)

const res = await fetch(healthUrl, {
  method: "GET",
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  },
})
const text = await res.text()

if (!res.ok) {
  console.error(`Auth health check failed: HTTP ${res.status}`)
  console.error(text.slice(0, 200))
  process.exit(1)
}

let json
try {
  json = JSON.parse(text)
} catch {
  console.error("Unexpected health response (not JSON)")
  process.exit(1)
}

// GoTrue exposes either `{ status: "ok" }` or version metadata depending on deployment
const authHealthy =
  json.status === "ok" ||
  (typeof json.name === "string" && json.name.includes("GoTrue"))
if (!authHealthy) {
  console.error("Unexpected health payload:", json)
  process.exit(1)
}

console.log("Supabase Auth: OK")

// Light REST sanity check with anon key (no table access; expects 401/406 without Accept header is fine)
const restUrl = `${url}/rest/v1/`
const restRes = await fetch(restUrl, {
  headers: {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  },
})
// 200 / 406 = typical; 401 = reachable but anon key mismatched invalid
const restOk =
  restRes.ok ||
  restRes.status === 401 ||
  restRes.status === 406 ||
  restRes.status === 415
if (!restOk) {
  console.error(`REST gateway unexpected: HTTP ${restRes.status}`)
  process.exit(1)
}
console.log("Supabase REST (anon credentials): reachable")

console.log("\nEnv check passed. Keys present; Supabase responded.")
