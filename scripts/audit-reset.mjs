// Clears the previous crawl's records so a run never reports stale routes.
//
// Deliberately a separate step rather than a Playwright beforeAll hook: the
// worker restarts after a test timeout, re-running beforeAll and truncating the
// log mid-crawl. Running once, before Playwright starts, cannot do that.
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "audit", "results");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
console.log("audit/results cleared");
