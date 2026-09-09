import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { CUSTOMER, OPERATOR, type RoleUser } from "@/lib/testing/role-users";

/**
 * T-03 for training progress. Self-scoped by construction: the row's
 * profile_id is the session's user id, never an argument, and the write goes
 * through the RLS-scoped client (own rows only). The gate is "signed in".
 */
const state = vi.hoisted(() => ({ ssr: null as unknown }));

vi.mock("@/lib/supabase-server", () => ({ createSSRClient: async () => state.ssr }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { markModuleComplete, setModuleProgress } from "./actions";

const ROW_ID = "70000000-0000-4000-8000-000000000070";

function signIn(user: RoleUser | null, existingRow: boolean) {
  state.ssr = makeFakeSupabase((call) => {
    if (call.table === "operator_training_progress" && call.op === "select") return { data: existingRow ? { id: ROW_ID } : null };
    return undefined;
  }, { user });
  return state.ssr as FakeSupabase;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("training progress", () => {
  it("refuses an anonymous caller before any read or write", async () => {
    const db = signIn(null, false);
    expect(await setModuleProgress("intro", 50)).toEqual({ error: "You are not signed in." });
    expect(await markModuleComplete("intro")).toEqual({ error: "You are not signed in." });
    expect(db.calls).toHaveLength(0);
  });

  it.each([["operator", OPERATOR], ["customer", CUSTOMER]] as Array<[string, RoleUser]>)(
    "%s inserts a row keyed to their own user id, with the percentage clamped",
    async (_label, user) => {
      const db = signIn(user, false);
      expect(await setModuleProgress("intro", 140)).toEqual({ success: true });
      const read = db.calls[0];
      expect(read.filters).toEqual(expect.arrayContaining([["eq", "profile_id", user.id], ["eq", "module_id", "intro"]]));
      const w = writes(db);
      expect(w).toHaveLength(1);
      expect(w[0]).toMatchObject({ table: "operator_training_progress", op: "insert" });
      expect(w[0].payload).toMatchObject({ profile_id: user.id, module_id: "intro", percent_complete: 100 });
      expect((w[0].payload as { completed_at: string | null }).completed_at).toMatch(/^\d{4}-/);
    }
  );

  it("updates the existing row by its id and leaves completed_at null below 100", async () => {
    const db = signIn(OPERATOR, true);
    expect(await setModuleProgress("intro", -20)).toEqual({ success: true });
    const w = writes(db);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ table: "operator_training_progress", op: "update" });
    expect(w[0].filters).toContainEqual(["eq", "id", ROW_ID]);
    expect(w[0].payload).toMatchObject({ profile_id: OPERATOR.id, percent_complete: 0, completed_at: null });
  });

  it("surfaces the database error rather than claiming success", async () => {
    state.ssr = makeFakeSupabase((call) => (call.op === "insert" ? { error: { message: "permission denied" } } : { data: null }), { user: OPERATOR });
    expect(await markModuleComplete("intro")).toEqual({ error: "permission denied" });
  });
});
