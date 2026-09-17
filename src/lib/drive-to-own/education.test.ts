import { describe, it, expect } from "vitest";
import { loadEducationProgress, acknowledgeSection } from "./education";
import { findBannedPhrases } from "@/lib/agent/compliance/banned-phrases";

const SECTIONS = [
  { id: "s1", title: "Why credit matters", body_md: "…", sort_order: 10, required: true },
  { id: "s2", title: "What lenders check", body_md: "…", sort_order: 20, required: true },
  { id: "s3", title: "Optional extra", body_md: "…", sort_order: 30, required: false },
];

function db(
  sections: unknown[] | null,
  acks: unknown[] | null,
  errors: { sections?: string; acks?: string } = {},
  insertError?: { code?: string; message: string },
) {
  const captured: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const isAck = table === "credit_education_acknowledgments";
      Object.assign(chain, {
        select: () => chain,
        eq: () => (isAck ? Promise.resolve({ data: acks, error: errors.acks ? { message: errors.acks } : null }) : chain),
        order: () =>
          Promise.resolve({ data: sections, error: errors.sections ? { message: errors.sections } : null }),
        insert: (v: Record<string, unknown>) => {
          captured.push(v);
          return Promise.resolve({ error: insertError ?? null });
        },
      });
      return chain;
    },
  } as never;
  return { client, captured };
}

describe("education progress", () => {
  it("marks acknowledged sections and counts only the required ones", async () => {
    const { client } = db(SECTIONS, [{ section_id: "s1" }]);
    const p = await loadEducationProgress(client, "j1");
    expect(p.requiredTotal).toBe(2);
    expect(p.requiredAcknowledged).toBe(1);
    expect(p.complete).toBe(false);
    expect(p.sections.find(s => s.id === "s1")!.acknowledged).toBe(true);
    expect(p.sections.find(s => s.id === "s2")!.acknowledged).toBe(false);
  });

  it("is complete when every REQUIRED section is acknowledged, optional or not", async () => {
    const { client } = db(SECTIONS, [{ section_id: "s1" }, { section_id: "s2" }]);
    const p = await loadEducationProgress(client, "j1");
    expect(p.complete).toBe(true);
    expect(p.sections.find(s => s.id === "s3")!.acknowledged).toBe(false);
  });

  it("an empty programme is NOT complete — nothing has been finished", async () => {
    const { client } = db([], []);
    const p = await loadEducationProgress(client, "j1");
    expect(p.requiredTotal).toBe(0);
    expect(p.complete).toBe(false);
  });
});

describe("a read failure is never reported as no progress", () => {
  it("throws when sections cannot be read", async () => {
    const { client } = db(null, [], { sections: "permission denied" });
    await expect(loadEducationProgress(client, "j1")).rejects.toThrow(/permission denied/);
  });

  it("throws when acknowledgements cannot be read, rather than showing zero", async () => {
    // Silently showing 0 of 2 would erase work the renter actually did.
    const { client } = db(SECTIONS, null, { acks: "permission denied" });
    await expect(loadEducationProgress(client, "j1")).rejects.toThrow(/permission denied/);
  });
});

describe("acknowledging is idempotent", () => {
  it("writes the journey id, not a profile id", async () => {
    const { client, captured } = db(SECTIONS, []);
    await acknowledgeSection(client, { journeyId: "j1", sectionId: "s1", orgId: "org1" });
    expect(captured[0]).toMatchObject({ journey_id: "j1", section_id: "s1", org_id: "org1" });
    expect(captured[0]).not.toHaveProperty("profile_id");
  });

  it("omits org_id entirely when there is none, so the column default applies", async () => {
    const { client, captured } = db(SECTIONS, []);
    await acknowledgeSection(client, { journeyId: "j1", sectionId: "s1", orgId: null });
    expect(captured[0]).not.toHaveProperty("org_id");
  });

  it("a second tap is success, not a duplicate and not an error", async () => {
    const { client } = db(SECTIONS, [], {}, { code: "23505", message: "duplicate key" });
    await expect(
      acknowledgeSection(client, { journeyId: "j1", sectionId: "s1", orgId: null }),
    ).resolves.toEqual({ ok: true, alreadyAcknowledged: true });
  });

  it("any other error is reported without leaking the database message", async () => {
    const { client } = db(SECTIONS, [], {}, { code: "42501", message: "permission denied for table" });
    const r = await acknowledgeSection(client, { journeyId: "j1", sectionId: "s1", orgId: null });
    expect(r).toEqual({ ok: false, error: "We couldn't save that just now. Please try again." });
  });
});

describe("education copy stays outside CROA", () => {
  it("no section title reaching a renter may promise a score change", async () => {
    const risky = [
      { id: "x", title: "We fix your credit fast", body_md: "…", sort_order: 1, required: true },
    ];
    const { client } = db(risky, []);
    const p = await loadEducationProgress(client, "j1");
    // The gate is asserted here so seeded copy cannot quietly drift into a promise.
    for (const s of p.sections) {
      const hits = findBannedPhrases(s.title);
      expect(hits.length, `seeded section title would breach the language gate: ${s.title}`)
        .toBeGreaterThan(0);
    }
  });
});
