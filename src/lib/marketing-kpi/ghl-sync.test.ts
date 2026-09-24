import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * S-6 (finding F-11): a failed read used to fall through as `?? []` / `?? 0`
 * and publish an all-zero week. Every read error must now throw, and nothing
 * may be upserted.
 */
const db = vi.hoisted(() => ({
  errors: {} as Record<string, { message: string; code?: string } | null>,
  upserts: 0,
}));

vi.mock("@/lib/ghl/client", () => ({ isGhlConfigured: () => true }));
vi.mock("@/lib/supabase-service", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      const result = () => ({ data: db.errors[table] ? null : [], count: 0, error: db.errors[table] ?? null });
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "gte", "lt", "eq"]) chain[m] = () => chain;
      chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(res, rej);
      chain.maybeSingle = async () => ({ data: null, error: db.errors[table] ?? null });
      chain.upsert = () => {
        db.upserts += 1;
        return { select: () => ({ single: async () => ({ data: { week_start: "2026-09-21" }, error: null }) }) };
      };
      return chain;
    },
  }),
}));

import { collectGhlKpiMetrics, syncMarketingKpiWeekFromGhl } from "./ghl-sync";

beforeEach(() => {
  db.errors = {};
  db.upserts = 0;
});

describe("GHL KPI sync reads fail loudly (S-6)", () => {
  it("collects when every read succeeds", async () => {
    const auto = await collectGhlKpiMetrics("2026-09-21");
    expect(auto.details.contacts_synced).toBe(0);
  });

  it.each(["ghl_contacts", "ghl_appointments", "ghl_form_submissions", "credit_billing_plans"])(
    "throws, naming the table, when %s cannot be read",
    async (table) => {
      db.errors[table] = { message: "permission denied", code: "42501" };
      await expect(collectGhlKpiMetrics("2026-09-21")).rejects.toThrow(table);
    }
  );

  it("never upserts a week built on a failed read", async () => {
    db.errors.ghl_contacts = { message: "Invalid API key", code: "401" };
    await expect(syncMarketingKpiWeekFromGhl("2026-09-21")).rejects.toThrow();
    expect(db.upserts).toBe(0);
  });

  it("does not upsert when the existing-week read fails (would zero manual fields)", async () => {
    db.errors.marketing_kpi_weeks = { message: "timeout", code: "57014" };
    await expect(syncMarketingKpiWeekFromGhl("2026-09-21")).rejects.toBeTruthy();
    expect(db.upserts).toBe(0);
  });

  it("upserts when everything reads", async () => {
    const out = await syncMarketingKpiWeekFromGhl("2026-09-21");
    expect(out.row).toMatchObject({ week_start: "2026-09-21" });
    expect(db.upserts).toBe(1);
  });
});
