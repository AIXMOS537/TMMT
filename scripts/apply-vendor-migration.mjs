#!/usr/bin/env node
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: resolve(root, ".env.vercel.production") });
dotenv.config({ path: resolve(root, ".env.local") });
dotenv.config({ path: resolve(root, ".env") });

const PROJECT_REF = "uapxakmlwnpfsftfeezx";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

async function managementQuery(query) {
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN required in .env");
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body}`);
  return body ? JSON.parse(body) : null;
}

async function columnExists() {
  if (!serviceKey || !supabaseUrl) return false;
  const res = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/vendors?select=service_verticals&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  );
  if (res.ok) return true;
  const text = await res.text();
  if (text.includes("service_verticals") || text.includes("PGRST204")) return false;
  if (res.status === 404) return false;
  throw new Error(`REST check failed ${res.status}: ${text}`);
}

const sqlPath = resolve(
  root,
  "supabase/migrations/20260520140000_vendor_service_verticals.sql"
);
const sql = readFileSync(sqlPath, "utf8");

try {
  if (await columnExists()) {
    console.log("OK: vendors.service_verticals already exists — migration skipped");
    process.exit(0);
  }
  await managementQuery(sql);
  console.log("OK: applied 20260520140000_vendor_service_verticals.sql");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
}
