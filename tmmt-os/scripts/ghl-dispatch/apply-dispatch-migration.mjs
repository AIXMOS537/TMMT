#!/usr/bin/env node
/**
 * Apply 0032_job_dispatch_hub.sql when SUPABASE_DB_URL or DATABASE_URL is set.
 * Fallback: prints path for Supabase SQL Editor.
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = resolve(__dirname, "../../supabase/migrations/0032_job_dispatch_hub.sql");
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.log("No SUPABASE_DB_URL — paste this file in Supabase SQL Editor:\n");
  console.log(sqlPath);
  process.exit(0);
}

const sql = readFileSync(sqlPath, "utf8");

try {
  const pg = await import("pg");
  const client = new pg.default.Client({ connectionString: dbUrl });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("Applied 0032_job_dispatch_hub.sql");
} catch (e) {
  if (e.code === "ERR_MODULE_NOT_FOUND") {
    console.error("Install pg: npm install pg --save-dev");
    console.error("Or paste SQL manually:", sqlPath);
  } else {
    console.error("Migration failed:", e.message);
  }
  process.exit(1);
}
