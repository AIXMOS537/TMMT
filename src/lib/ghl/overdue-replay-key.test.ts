import { describe, expect, it } from "vitest";
import { overdueReplayKey } from "./overdue-replay-key";

/** T-02c: the content-hash-by-UTC-day key behind the ghl/overdue replay gate. */
const signal = { contact_id: "ghl-c-late", amount_due: 250, due_date: "2026-09-01" };
const day = new Date("2026-09-08T12:00:00.000Z");

describe("overdueReplayKey", () => {
  it("is deterministic for the same state on the same UTC day", () => {
    expect(overdueReplayKey(signal, day)).toBe(overdueReplayKey({ ...signal }, day));
    expect(overdueReplayKey(signal, day)).toMatch(/^overdue:v1:[0-9a-f]{64}$/);
  });

  it("treats a numeric and a string amount as the same state (the python producer sends strings)", () => {
    expect(overdueReplayKey({ ...signal, amount_due: "250" }, day)).toBe(overdueReplayKey(signal, day));
    expect(overdueReplayKey({ ...signal, amount_due: " 250 " }, day)).toBe(overdueReplayKey(signal, day));
  });

  it("changes with contact, amount or due date", () => {
    const base = overdueReplayKey(signal, day);
    expect(overdueReplayKey({ ...signal, contact_id: "ghl-c-other" }, day)).not.toBe(base);
    expect(overdueReplayKey({ ...signal, amount_due: 300 }, day)).not.toBe(base);
    expect(overdueReplayKey({ ...signal, due_date: "2026-09-02" }, day)).not.toBe(base);
  });

  it("changes across the UTC day boundary but not within a day", () => {
    const late = overdueReplayKey(signal, new Date("2026-09-08T23:59:59.000Z"));
    expect(late).toBe(overdueReplayKey(signal, new Date("2026-09-08T00:00:00.000Z")));
    expect(overdueReplayKey(signal, new Date("2026-09-09T00:00:00.000Z"))).not.toBe(late);
  });

  it("ignores presentation fields the route also accepts (customer_name, source)", () => {
    const decorated = { ...signal, customer_name: "Late Payer", source: "n8n" };
    expect(overdueReplayKey(decorated, day)).toBe(overdueReplayKey(signal, day));
  });

  it("a missing amount or due date hashes as empty, not as the string 'undefined'", () => {
    expect(overdueReplayKey({ contact_id: "c" }, day)).toBe(
      overdueReplayKey({ contact_id: "c", amount_due: "", due_date: "" }, day)
    );
  });
});
