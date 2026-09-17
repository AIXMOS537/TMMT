import { describe, it, expect } from "vitest";
import { loadTraining, markModuleProgress } from "./training";

const MODULES = [
  { id: "m1", slug: "a", title: "Core one", summary: null, content_md: "…", sort_order: 10, is_core: true },
  { id: "m2", slug: "b", title: "Core two", summary: null, content_md: "…", sort_order: 20, is_core: true },
  { id: "m3", slug: "c", title: "Extra", summary: null, content_md: "…", sort_order: 30, is_core: false },
];

function db(
  modules: unknown[] | null,
  progress: unknown[] | null,
  errs: { modules?: string; progress?: string; upsert?: string } = {},
) {
  const captured: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      const isProg = table === "training_module_progress";
      const chain: Record<string, unknown> = {};
      Object.assign(chain, {
        select: () => chain,
        eq: () =>
          isProg
            ? Promise.resolve({ data: progress, error: errs.progress ? { message: errs.progress } : null })
            : chain,
        order: () => Promise.resolve({ data: modules, error: errs.modules ? { message: errs.modules } : null }),
        upsert: (v: Record<string, unknown>) => {
          captured.push(v);
          return Promise.resolve({ error: errs.upsert ? { message: errs.upsert } : null });
        },
      });
      return chain;
    },
  } as never;
  return { client, captured };
}

describe("core modules decide the gate, optional ones do not", () => {
  it("both core done is complete even with the optional untouched", async () => {
    const { client } = db(MODULES, [
      { module_id: "m1", percent_complete: 100 },
      { module_id: "m2", percent_complete: 100 },
    ]);
    const t = await loadTraining(client, "j1");
    expect(t.coreTotal).toBe(2);
    expect(t.coreComplete).toBe(2);
    expect(t.complete).toBe(true);
    expect(t.modules.find(m => m.id === "m3")!.percent_complete).toBe(0);
  });

  it("99% on a core module is not complete", async () => {
    const { client } = db(MODULES, [
      { module_id: "m1", percent_complete: 100 },
      { module_id: "m2", percent_complete: 99 },
    ]);
    const t = await loadTraining(client, "j1");
    expect(t.coreComplete).toBe(1);
    expect(t.complete).toBe(false);
  });

  it("a module with no progress row reads as 0, not undefined", async () => {
    const { client } = db(MODULES, []);
    const t = await loadTraining(client, "j1");
    expect(t.modules.every(m => m.percent_complete === 0)).toBe(true);
    expect(t.complete).toBe(false);
  });

  it("a programme with no core modules is not complete", async () => {
    const { client } = db([MODULES[2]], []);
    const t = await loadTraining(client, "j1");
    expect(t.coreTotal).toBe(0);
    expect(t.complete).toBe(false);
  });
});

describe("a read failure is never shown as no progress", () => {
  it("throws when modules cannot be read", async () => {
    const { client } = db(null, [], { modules: "permission denied" });
    await expect(loadTraining(client, "j1")).rejects.toThrow(/permission denied/);
  });
  it("throws when progress cannot be read", async () => {
    const { client } = db(MODULES, null, { progress: "permission denied" });
    await expect(loadTraining(client, "j1")).rejects.toThrow(/permission denied/);
  });
});

describe("marking progress", () => {
  it("writes the journey id and upserts on the unique pair", async () => {
    const { client, captured } = db(MODULES, []);
    await markModuleProgress(client, { journeyId: "j1", moduleId: "m1", percent: 100 });
    expect(captured[0]).toMatchObject({ journey_id: "j1", module_id: "m1", percent_complete: 100 });
    expect(captured[0]).not.toHaveProperty("profile_id");
  });

  it("stamps completed_at only at 100", async () => {
    const { client, captured } = db(MODULES, []);
    await markModuleProgress(client, { journeyId: "j1", moduleId: "m1", percent: 50 });
    expect(captured[0].completed_at).toBeNull();
    await markModuleProgress(client, { journeyId: "j1", moduleId: "m1", percent: 100 });
    expect(captured[1].completed_at).not.toBeNull();
  });

  it.each([-1, 101, 250, NaN, Infinity])("refuses %s before it reaches the database", async bad => {
    // 250 would read as complete to any >= 100 check and quietly clear a gate.
    const { client, captured } = db(MODULES, []);
    const r = await markModuleProgress(client, { journeyId: "j1", moduleId: "m1", percent: bad });
    expect(r).toEqual({ ok: false, error: "Progress must be between 0 and 100." });
    expect(captured).toHaveLength(0);
  });

  it("does not leak the database message to the renter", async () => {
    const { client } = db(MODULES, [], { upsert: 'relation "training_module_progress" does not exist' });
    const r = await markModuleProgress(client, { journeyId: "j1", moduleId: "m1", percent: 100 });
    expect(r).toEqual({ ok: false, error: "We couldn't save that just now. Please try again." });
  });
});
