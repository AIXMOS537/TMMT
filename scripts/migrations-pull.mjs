#!/usr/bin/env node
/**
 * Pull production's applied migration history back into supabase/migrations.
 *
 * Why this exists
 * ---------------
 * The repo and the database have drifted apart, badly and in one direction:
 * on 2026-09-01 production had 220 applied migrations and the repo had 39. Of
 * the 89 distinct tables the application code reads or writes, 49 have no
 * CREATE TABLE anywhere in the repo. docs/RECONCILIATION-lead-systems.md has
 * recorded the problem since August; this is the mechanism for decision #4 in
 * it — "export prod's applied migrations back into supabase/migrations".
 *
 * The drift is not cosmetic. Nearly every CREATE TABLE in the repo is
 * `CREATE TABLE IF NOT EXISTS`, so where production already held a table of
 * that name the repo's definition was a no-op — meaning the repo's column list
 * is not evidence of production's column list, only of what the repo believes.
 * And nothing catches it at build time: there is no generated types file, so
 * every mismatch surfaces as a runtime failure in front of a user.
 *
 * What it does
 * ------------
 * Reads supabase_migrations.schema_migrations — which stores the exact SQL of
 * every applied migration in its `statements` array — and writes one
 * <version>_<name>.sql per row. Existing files are left alone unless --force.
 * Nothing is applied and nothing is dropped; this only ever writes files.
 *
 * Usage
 * -----
 *   SUPABASE_DB_URL='postgresql://...' node scripts/migrations-pull.mjs
 *   node scripts/migrations-pull.mjs --dry-run      # report the gap only
 *   node scripts/migrations-pull.mjs --force        # overwrite existing files
 *   node scripts/migrations-pull.mjs --out supabase/migrations/_from-prod
 *
 * The connection string is the "Direct connection" or session pooler URI from
 * Supabase → Project Settings → Database. It is read from the environment and
 * never written anywhere.
 *
 * After running, read the diff before committing. Files that appear are what
 * production has been running without the repo knowing.
 */

import { mkdirSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const FORCE = args.has("--force");

const outIdx = process.argv.indexOf("--out");
const OUT = resolve(outIdx > -1 ? process.argv[outIdx + 1] : "supabase/migrations");

const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!url) {
  console.error(
    "Set SUPABASE_DB_URL to the project's Postgres connection string.\n" +
      "Supabase dashboard → Project Settings → Database → Connection string."
  );
  process.exit(1);
}

let pg;
try {
  ({ default: pg } = await import("pg"));
} catch {
  console.error("This needs the `pg` package: npm i -D pg");
  process.exit(1);
}

// Verify the certificate. Supabase presents a normally-signed one, so there is
// no reason to turn this off — and turning it off on a connection that carries
// the whole schema (and the credentials to read it) is how a session gets
// intercepted. If a corporate proxy re-signs traffic, add its CA with
// NODE_EXTRA_CA_CERTS rather than disabling the check.
const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: true },
});

/** Filenames are paths — never trust a name straight out of the database. */
function safeName(version, name) {
  const clean = String(name || "unnamed")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);
  return `${version}_${clean}.sql`;
}

await client.connect();
try {
  const { rows } = await client.query(
    `select version, name, statements
       from supabase_migrations.schema_migrations
      order by version`
  );

  mkdirSync(OUT, { recursive: true });
  const onDisk = new Set(
    existsSync(OUT) ? readdirSync(OUT).filter((f) => f.endsWith(".sql")) : []
  );

  let written = 0;
  let skipped = 0;
  const missing = [];

  for (const row of rows) {
    const file = safeName(row.version, row.name);
    const exists = onDisk.has(file);

    if (exists && !FORCE) {
      skipped++;
      continue;
    }
    missing.push(file);
    if (DRY) continue;

    const sql = (row.statements ?? []).join("\n");
    const header =
      `-- Exported from production migration history (${row.version}).\n` +
      `-- Source of truth: supabase_migrations.schema_migrations.\n` +
      `-- Do not edit by hand — re-run scripts/migrations-pull.mjs instead.\n\n`;
    writeFileSync(join(OUT, file), header + sql + "\n", "utf8");
    written++;
  }

  console.log(`applied in production : ${rows.length}`);
  console.log(`already in the repo   : ${skipped}`);
  console.log(`${DRY ? "would write" : "written"}            : ${missing.length}`);

  if (missing.length && DRY) {
    console.log("\nmissing from the repo:");
    for (const f of missing) console.log("  " + f);
  }
  if (!DRY && written) console.log(`\nwrote ${written} file(s) to ${OUT}`);
} finally {
  await client.end();
}
