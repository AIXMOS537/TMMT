#!/usr/bin/env node
/**
 * Pull open ClickUp tasks → OWNER-WORK-INTAKE → m1-work-router.
 * Token: CLICKUP_API_TOKEN or CLICKUP_TOKEN in .env / ~/.config/tmmt/clickup.env
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { loadProjectEnv } from "../load-env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const intake = join(process.env.HOME || "", "Brain/vault/00-Dashboard/OWNER-WORK-INTAKE/business");
const seenFile = join(process.env.HOME || "", ".config/tmmt/.clickup-intake-seen.json");

function loadClickupEnv() {
  const p = join(process.env.HOME || "", ".config/tmmt/clickup.env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
    if (key === "CLICKUP_TOKEN" && !process.env.CLICKUP_API_TOKEN) {
      process.env.CLICKUP_API_TOKEN = val;
    }
  }
}

loadProjectEnv();
loadClickupEnv();

const token = process.env.CLICKUP_API_TOKEN || process.env.CLICKUP_TOKEN;
const teamId = process.env.CLICKUP_TEAM_ID || "90132245195";
const lists = [
  process.env.CLICKUP_LIST_OPS || "901318985770",
  process.env.CLICKUP_LIST_FLEET || "901318986996",
  process.env.CLICKUP_LIST_TICKETS || "901318986343",
].filter(Boolean);

if (!token || token.length < 10) {
  console.log("clickup-intake: no token — skip");
  process.exit(0);
}

let seen = {};
try {
  seen = JSON.parse(readFileSync(seenFile, "utf8"));
} catch {
  seen = {};
}

mkdirSync(intake, { recursive: true });
let newCount = 0;

for (const listId of lists) {
  const url = `https://api.clickup.com/api/v2/list/${listId}/task?archived=false&include_closed=false`;
  const res = await fetch(url, { headers: { Authorization: token } });
  if (!res.ok) {
    console.log(`clickup-intake: list ${listId} HTTP ${res.status}`);
    continue;
  }
  const data = await res.json();
  for (const task of data.tasks || []) {
    if (seen[task.id]) continue;
    const status = task.status?.status?.toLowerCase() || "";
    if (status.includes("closed") || status.includes("complete")) continue;
    const fname = `clickup-${task.id}-${(task.name || "task").slice(0, 40).replace(/[^a-zA-Z0-9]+/g, "-")}.md`;
    const body = `# ClickUp: ${task.name}\n\nstatus: ${task.status?.status || "open"}\nurl: ${task.url || ""}\nlist: ${listId}\n\n${task.description || ""}\n`;
    writeFileSync(join(intake, fname), body);
    seen[task.id] = Date.now();
    newCount++;
    console.log(`clickup-intake: + ${task.name}`);
  }
}

writeFileSync(seenFile, JSON.stringify(seen, null, 2));
console.log(`clickup-intake: ${newCount} new task(s)`);
