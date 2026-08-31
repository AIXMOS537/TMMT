#!/usr/bin/env node
/**
 * invite — mint a single-use sign-up code for tmmt-ops.
 *
 * Public sign-up is invite-only. This is the only way to hand someone an
 * account. The code is printed ONCE and never stored in the clear; the database
 * only ever sees sha256(normalized code), so a leaked backup is not a set of
 * working invites.
 *
 *   node scripts/invite.mjs --for "Khan Strategies"
 *   node scripts/invite.mjs --for "Aayan" --email aayan@example.com --days 7
 *   node scripts/invite.mjs --list           # who has an open invite
 *   node scripts/invite.mjs --revoke <id>    # burn an unused invite now
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — same key seat.sh uses.
 *
 * NOTE: the alphabet + normalize + hash below MUST stay identical to
 * src/lib/signup-invite.ts, which is what the sign-up action verifies against.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";
import { loadProjectEnv } from "./load-env.mjs";

const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ0123456789";
const normalize = (raw) => String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const hash = (raw) => createHash("sha256").update(normalize(raw)).digest("hex");

function generate() {
  let out = "";
  for (const b of randomBytes(16)) out += ALPHABET[b % ALPHABET.length];
  return out.replace(/(.{4})(?=.)/g, "$1-");
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

function die(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}

loadProjectEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) die("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");

const db = createClient(url, key, { auth: { persistSession: false } });

async function assertTable() {
  const { error } = await db.from("signup_invites").select("id").limit(1);
  if (error) {
    die(
      `signup_invites is unreachable (${error.message}).\n` +
        "  Apply supabase/migrations/20260831000000_signup_invites.sql first — " +
        "until it exists, sign-up is closed to everyone."
    );
  }
}

if (has("list")) {
  await assertTable();
  const { data, error } = await db
    .from("signup_invites")
    .select("id, label, email, expires_at, used_at, used_by, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) die(error.message);
  if (!data.length) {
    console.log("No invites yet. Mint one:  node scripts/invite.mjs --for \"Their Name\"");
    process.exit(0);
  }
  const now = Date.now();
  console.log("\n  INVITES (newest first)\n");
  for (const r of data) {
    const state = r.used_at
      ? "\x1b[90mredeemed\x1b[0m"
      : new Date(r.expires_at).getTime() <= now
        ? "\x1b[33mexpired \x1b[0m"
        : "\x1b[32mOPEN    \x1b[0m";
    console.log(
      `  ${state}  ${r.label ?? "(no label)"}${r.email ? ` <${r.email}>` : ""}\n` +
        `            id ${r.id} · expires ${r.expires_at.slice(0, 10)}`
    );
  }
  console.log("");
  process.exit(0);
}

const revokeId = arg("revoke");
if (revokeId) {
  await assertTable();
  const { data, error } = await db
    .from("signup_invites")
    .delete()
    .eq("id", revokeId)
    .is("used_at", null)
    .select("id, label");
  if (error) die(error.message);
  if (!data.length) die("No OPEN invite with that id (already redeemed, or wrong id).");
  console.log(`\x1b[32m✓ revoked\x1b[0m ${data[0].label ?? data[0].id} — that code is dead.`);
  process.exit(0);
}

const label = arg("for");
if (!label) {
  console.log(`
  invite — mint a single-use sign-up code

    node scripts/invite.mjs --for "Their Name" [--email them@x.com] [--days 14]
    node scripts/invite.mjs --list
    node scripts/invite.mjs --revoke <id>

  --email locks the code to that address; nobody else can redeem it.
`);
  process.exit(1);
}

await assertTable();

const days = Number(arg("days", "14"));
if (!Number.isFinite(days) || days < 1 || days > 90) die("--days must be a number between 1 and 90.");
const email = arg("email") ? arg("email").trim().toLowerCase() : null;

const code = generate();
const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();

const { data, error } = await db
  .from("signup_invites")
  .insert({ code_hash: hash(code), label, email, expires_at: expiresAt, created_by: "invite.mjs" })
  .select("id")
  .single();
if (error) die(error.message);

console.log(`
  ╔══════════════════════════════════════════════╗
  ║  TMMT · SIGN-UP INVITE                       ║
  ╚══════════════════════════════════════════════╝

     for : ${label}${email ? `\n    email : ${email}  (locked — only this address)` : ""}
  expires : ${expiresAt.slice(0, 10)}  (${days} days)
       id : ${data.id}

     CODE : \x1b[1m\x1b[32m${code}\x1b[0m

  Give them this code and https://tmmt-ops.vercel.app/login → Create account.
  It works ONCE. It is not stored anywhere — if it is lost, revoke and mint again.
`);
