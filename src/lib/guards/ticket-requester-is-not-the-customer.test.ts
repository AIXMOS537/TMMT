/**
 * `tickets.requested_by_customer` is NOT the customer, and no screen may say it is.
 *
 * VERIFIED IN PRODUCTION 2026-09-16:
 *   - 308 rows in `tickets`
 *   - `requested_by_customer` holds **12 distinct values, and they are STAFF names**
 *     (it records who raised the ticket)
 *   - `customer_linked` is populated on **0 of 308** rows
 *   - `date_closed` on 0, `status` null on all 308, and
 *     `total_customer_ticket_balance` holds a single distinct value
 *
 * So not one toll in this system is attributable to a renter. The admin tickets screen
 * nonetheless labelled this column "Customer", and the desk widget printed it as the
 * customer's name — which invites chasing the wrong person for money, and under the
 * Drive-to-Own rules an unpaid toll is one of the three things that costs a renter their
 * path to owning a car. Attributing one to the wrong person is a real harm.
 *
 * This is a static scan rather than a render test because the risk is anywhere in the
 * codebase, not in one component.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

function sourceFiles(): string[] {
  // git ls-files keeps this to tracked source and avoids walking node_modules/.next.
  // execFileSync, not execSync: through cmd.exe (Windows) the single quotes were
  // passed to git literally, the pathspecs matched nothing, and the guard found zero
  // files. Arguments passed directly need no shell quoting on any platform.
  return execFileSync("git", ["ls-files", "src/**/*.ts", "src/**/*.tsx"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter(f => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));
}

describe("no screen presents requested_by_customer as the customer", () => {
  const files = sourceFiles().filter(f => readFileSync(f, "utf8").includes("requested_by_customer"));

  it("finds the call sites it is meant to police", () => {
    // If this ever hits zero the guard has silently stopped guarding anything.
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(["src/app/(admin)/tickets/page.tsx", "src/app/(admin)/desk/page.tsx"])(
    "%s does not label it Customer",
    file => {
      const src = readFileSync(file, "utf8");
      // A label/header of exactly "Customer" adjacent to this column is the bug.
      expect(src).not.toMatch(/label:\s*"Customer"/);
      expect(src).not.toMatch(/label="Customer"/);
    },
  );

  it("no file pairs the column with a bare Customer label", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        if (!line.includes("requested_by_customer")) return;
        const window = lines.slice(Math.max(0, i - 2), i + 3).join("\n");
        expect(
          /label:\s*"Customer"|label="Customer"|>Customer</.test(window),
          `${f}:${i + 1} presents requested_by_customer as the customer`,
        ).toBe(false);
      });
    }
  });
});
