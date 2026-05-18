import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
  ["f1107956-b2c2-498a-bc0a-732cb43a01a2", "aixmos@icloud.com"],
  ["7e9fa632-304e-400d-acf0-fec29bb54601", "partner-portal-test@tmmt-rentals.local"],
  ["2da74163-0b2f-4b1e-8dcd-3a7be2f8430d", "management@tmmtrentals.net"],
];

for (const [id, email] of users) {
  const { error } = await admin.auth.admin.updateUserById(id, {
    password: "TmmtPortalTest!2026",
  });
  console.log(email, error ? error.message : "password set");
}
