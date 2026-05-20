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
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN required");
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

async function tableExists(table) {
  if (!serviceKey || !supabaseUrl) return false;
  const res = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${table}?select=id&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  );
  if (res.ok) return true;
  const text = await res.text();
  if (text.includes("does not exist") || text.includes("PGRST205")) return false;
  if (res.status === 404) return false;
  throw new Error(`REST check ${table}: ${res.status} ${text}`);
}

const workflowPath = resolve(root, "supabase/migrations/20260516120000_workflow_engine.sql");
const vendorColsPath = resolve(
  root,
  "supabase/migrations/20260520140000_vendor_service_verticals.sql"
);

try {
  if (await tableExists("cases")) {
    console.log("OK: cases table already exists — workflow migration skipped");
  } else {
    const sql = readFileSync(workflowPath, "utf8");
    await managementQuery(sql);
    console.log("OK: applied 20260516120000_workflow_engine.sql");
  }

  if (await tableExists("vendors")) {
    const vendorSql = readFileSync(vendorColsPath, "utf8");
    await managementQuery(vendorSql);
    console.log("OK: applied vendor service_verticals columns (idempotent)");
  }

  const rpc = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/submit_customer_intake`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_contact_name: "__migration_probe__",
        p_request_type: "general",
      }),
    }
  );
  if (rpc.status === 404) {
    console.warn("WARN: submit_customer_intake RPC not reachable yet");
  } else {
    console.log("OK: submit_customer_intake RPC reachable");
    if (rpc.ok) {
      const id = await rpc.json();
      if (id) {
        await managementQuery(
          `DELETE FROM public.cases WHERE id = '${id}'::uuid;`
        );
        console.log("OK: cleaned probe intake case");
      }
    }
  }
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
}
