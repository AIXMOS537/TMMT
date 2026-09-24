import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The credit dispute desk must never put a client record in browser storage.
 *
 * That record is legal name, email, phone, date of birth, social-security last
 * four, home address and tri-bureau scores. It lived in localStorage under
 * "aix-dispute-clients" until 50598360 moved it into public.dispute_clients
 * behind RLS, platform-admin only.
 *
 * This is a guard, not a unit test, because the regression does not look like a
 * bug when it arrives — it looks like a merge conflict. A stale branch resolved
 * toward its own side puts the browser store straight back, and every other test
 * still passes because the feature works either way. The only difference is
 * where the data sits.
 *
 * The one permitted use is the one-way rescue: read the old key and delete it,
 * so clients stranded on one machine can be moved into the database. Reading and
 * removing are allowed. Writing is not.
 */
const ROOTS = [
  join(process.cwd(), "src", "lib", "credit-dispute"),
  join(process.cwd(), "src", "app", "(command)", "command", "credit-dispute"),
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

/** Strip comments so a line *describing* the old behaviour is not a failure. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("the credit dispute desk keeps client PII out of the browser", () => {
  const files = ROOTS.flatMap(sourceFiles);

  it("finds the desk's source (guard is not silently scanning nothing)", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("never writes to localStorage or sessionStorage", () => {
    const offenders = files.filter((f) => {
      const src = code(readFileSync(f, "utf8"));
      return /(localStorage|sessionStorage)\s*\.\s*setItem/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it("only touches the legacy key to read it and delete it", () => {
    for (const f of files) {
      const src = code(readFileSync(f, "utf8"));
      for (const m of src.matchAll(/(localStorage|sessionStorage)\s*\.\s*(\w+)/g)) {
        expect(["getItem", "removeItem"]).toContain(m[2]);
      }
    }
  });

  it("the page reads clients through the server action, not a browser store", () => {
    const page = readFileSync(
      join(process.cwd(), "src", "app", "(command)", "command", "credit-dispute", "page.tsx"),
      "utf8"
    );
    expect(page).toContain("listDisputeClients");
    // The browser-store readers that the accuracy gate used to call.
    for (const gone of ["getAssessments(", "roundsSentByItem(", "setItemAssessment("]) {
      expect(code(page)).not.toContain(gone);
    }
  });
});
