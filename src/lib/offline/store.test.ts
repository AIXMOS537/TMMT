import { expect, it } from "vitest";
import { outboxAdd } from "./store";

it("rejects an outbox write when IndexedDB is unavailable", async () => {
  await expect(outboxAdd("contracts", { id: "c1" })).rejects.toThrow("no indexedDB");
});
