#!/usr/bin/env node
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const role = process.env.ROLE || "operator";
const vertical = process.env.VERTICAL || "generic";
const NEXT = process.env.NEXT || "order";
const HOST = process.env.HOST || "mac";
const skin = process.env.SERVE_SKIN || "";

const cfg = JSON.parse(readFileSync(join(ROOT, "config/serve-menu.json"), "utf8"));
const r = cfg.roles[role] || cfg.roles.operator;
const v = cfg.verticals[vertical] || cfg.verticals.generic;

const isTTY = process.stdout.isTTY;
const W = isTTY ? "\x1b[1;97m" : "";
const D = isTTY ? "\x1b[2m" : "";
const X = isTTY ? "\x1b[0m" : "";
const G = isTTY ? "\x1b[38;5;46m" : "";
const C = skin === "hailmary" ? (isTTY ? "\x1b[38;5;196m" : "") : (isTTY ? "\x1b[38;5;51m" : "");
const H = skin === "hailmary" ? (isTTY ? "\x1b[38;5;33m" : "") : C;

const lines = [];
lines.push("");
lines.push(`${H}      ▓▓▒▒░░  T H E   R E S T A U R A N T  ░░▒▒▓▓${X}`);
lines.push(`${W}  ${r.badge}${v.badge ? ` · ${v.badge}` : ""}${X}`);
lines.push(`${D}  ${r.hello}${X}`);
lines.push("");

for (const sec of r.sections || []) {
  lines.push(`${C}  ═══ ${sec.title} ═══${X}`);
  for (const it of sec.items || []) {
    lines.push(`${G}  ${it.icon} ${it.label.padEnd(16)}${X} ${D}┊${X} ${D}${it.hint}${X}`);
    lines.push(`${D}      → ${C}${it.cmd}${X}`);
  }
  lines.push("");
}

lines.push("  ┌──────────────────────────────────────────────────────────────┐");
lines.push(`  │  ⚡ ONE THING NEXT                                           │`);
lines.push(`  │  ${NEXT.padEnd(58)}│`);
lines.push("  └──────────────────────────────────────────────────────────────┘");
lines.push("");
lines.push(`${D}  Daily: ${W}order${X} · ${HOST} · ${role}${X}`);
lines.push("");
process.stdout.write(lines.join("\n"));
