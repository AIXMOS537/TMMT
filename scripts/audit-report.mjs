// Turns the raw crawl records into audit/FINDINGS.md — a numbered, ordered
// work queue rather than a wall of logs. Fix them top to bottom.
//
//   node scripts/audit-report.mjs

import fs from "node:fs";
import path from "node:path";

const RESULTS = path.join(process.cwd(), "audit", "results");
const OUT = path.join(process.cwd(), "audit", "FINDINGS.md");

const SEVERITY_ORDER = { blocker: 0, broken: 1, warning: 2, info: 3 };
const SEVERITY_LABEL = {
  blocker: "🔴 Blocker",
  broken: "🟠 Broken",
  warning: "🟡 Warning",
  info: "⚪ Info",
};

function load(file) {
  const full = path.join(RESULTS, file);
  if (!fs.existsSync(full)) return [];
  return fs
    .readFileSync(full, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

// A route can appear twice: when a test times out Playwright restarts its
// worker, and the afterEach hook that rescues timed-out routes runs in both.
// The log is append-only evidence, so reconcile here rather than there —
// keeping whichever record saw more, so a rescue stub never hides real
// findings and a real record never hides a timeout.
function dedupe(rows) {
  const best = new Map();
  for (const r of rows) {
    const key = `${r.route}::${r.authed}`;
    const prev = best.get(key);
    if (!prev || r.findings.length > prev.findings.length) best.set(key, r);
  }
  return [...best.values()];
}

const anon = dedupe(load("anon.ndjson"));
const authedRoutes = dedupe(load("authed.ndjson"));
const routes = [...anon, ...authedRoutes];

if (routes.length === 0) {
  console.error("No crawl results found. Run `npm run audit:crawl` first.");
  process.exit(1);
}

const findings = routes.flatMap((r) => r.findings);

// Group identical defects across routes: one systemic bug reported 22 times is
// one line of work, not 22. The route list travels with it so nothing is lost.
const groups = new Map();
for (const f of findings) {
  const key = `${f.severity}::${f.kind}::${f.detail}`;
  if (!groups.has(key)) groups.set(key, { ...f, routes: new Set() });
  // A Set, not an array: one route can emit the same generic error a dozen
  // times (one per failed fetch on a dashboard), and listing it a dozen times
  // says nothing that listing it once does not.
  groups.get(key).routes.add(`${f.route}${f.authed ? " (signed in)" : ""}`);
}
for (const g of groups.values()) g.routes = [...g.routes].sort();

const ordered = [...groups.values()].sort(
  (a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    b.routes.length - a.routes.length ||
    a.kind.localeCompare(b.kind)
);

const counts = { blocker: 0, broken: 0, warning: 0, info: 0 };
for (const g of ordered) counts[g.severity] += 1;

const clean = routes.filter((r) => r.findings.length === 0);
const slowest = [...routes].sort((a, b) => b.loadMs - a.loadMs).slice(0, 5);

const lines = [
  "# TMMT — Live App Audit Findings",
  "",
  `> Generated ${new Date().toISOString()} · ${routes.length} route visits · ` +
    `${anon.length} signed out, ${authedRoutes.length} signed in`,
  "",
  authedRoutes.length === 0
    ? "> ⚠️ **Signed-out pass only.** Admin pages were not exercised. Set `AUDIT_EMAIL` " +
      "and `AUDIT_PASSWORD` and re-run to audit the 23 protected pages."
    : "",
  "",
  "## Scoreboard",
  "",
  "| Severity | Distinct issues |",
  "|---|---|",
  `| 🔴 Blocker | ${counts.blocker} |`,
  `| 🟠 Broken | ${counts.broken} |`,
  `| 🟡 Warning | ${counts.warning} |`,
  `| ⚪ Info | ${counts.info} |`,
  "",
  `**${clean.length} of ${routes.length} route visits were completely clean.**`,
  "",
  "## Fix queue",
  "",
  ordered.length === 0 ? "Nothing found. The crawl was clean." : "",
];

ordered.forEach((g, i) => {
  const n = i + 1;
  const shown = g.routes.slice(0, 8).join(", ");
  const more = g.routes.length > 8 ? ` _+${g.routes.length - 8} more_` : "";
  lines.push(
    `### ${n}. ${SEVERITY_LABEL[g.severity]} — ${g.kind}`,
    "",
    `**What the crawler saw:** ${g.detail}`,
    "",
    `**Where:** ${g.routes.length} route${g.routes.length === 1 ? "" : "s"} — ${shown}${more}`,
    ""
  );
});

lines.push(
  "## Slowest routes",
  "",
  "| Route | Load (ms) |",
  "|---|---|",
  ...slowest.map((r) => `| ${r.route}${r.authed ? " (signed in)" : ""} | ${r.loadMs} |`),
  "",
  "## Clean routes",
  "",
  clean.length === 0
    ? "_None._"
    : clean.map((r) => `\`${r.route}\`${r.authed ? " (signed in)" : ""}`).join(" · "),
  "",
  "---",
  "",
  "Screenshots of every route: `audit/screens/`. Raw records: `audit/results/`.",
  ""
);

fs.writeFileSync(OUT, lines.filter((l) => l !== undefined).join("\n"), "utf8");

console.log(
  `audit/FINDINGS.md written — ${counts.blocker} blocker, ${counts.broken} broken, ` +
    `${counts.warning} warning, ${counts.info} info across ${routes.length} route visits.`
);
