import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Minimal recording double for the supabase-js query builder, for route tests.
 *
 * Every `from(table)` opens one FakeDbCall. Builder methods record what the
 * route asked for (op, payload, filters) and return the same builder, so any
 * chain the real code writes (`.insert().select().single()`,
 * `.update().eq()`, `.select().ilike().limit()` awaited directly) resolves
 * through the single `respond` callback. Nothing here talks to a network.
 *
 * Tests assert on `client.calls` — the whole point of T-02 is "did a rejected
 * request reach the database?", and that is answered by an empty `calls` list.
 */
export type FakeDbCall = {
  table: string;
  op: "select" | "insert" | "upsert" | "update" | "delete" | null;
  payload?: unknown;
  options?: unknown;
  columns?: string;
  /** [method, column, value] in call order, e.g. ["eq", "id", "lead-1"]. */
  filters: Array<[string, unknown, unknown]>;
};

export type FakeDbError = { code?: string; message: string };
export type FakeDbResponse = { data?: unknown; error?: FakeDbError | null };
export type FakeDbResponder = (call: FakeDbCall) => FakeDbResponse | undefined;

export type FakeSupabase = SupabaseClient & { calls: FakeDbCall[] };

const FILTER_METHODS = [
  "eq",
  "neq",
  "ilike",
  "like",
  "is",
  "in",
  "gt",
  "gte",
  "lt",
  "lte",
  "order",
  "limit",
  "range",
] as const;

export function makeFakeSupabase(respond: FakeDbResponder = () => undefined): FakeSupabase {
  const calls: FakeDbCall[] = [];

  const from = (table: string) => {
    const call: FakeDbCall = { table, op: null, filters: [] };
    calls.push(call);

    const resolve = () => {
      const r = respond(call) ?? {};
      return { data: r.data ?? null, error: r.error ?? null };
    };

    const builder: Record<string, unknown> = {};
    const mutation =
      (op: Exclude<FakeDbCall["op"], null | "select">) =>
      (payload?: unknown, options?: unknown) => {
        call.op = op;
        call.payload = payload;
        call.options = options;
        return builder;
      };

    builder.insert = mutation("insert");
    builder.upsert = mutation("upsert");
    builder.update = mutation("update");
    builder.delete = mutation("delete");
    builder.select = (columns?: string) => {
      if (!call.op) call.op = "select";
      call.columns = columns;
      return builder;
    };
    for (const method of FILTER_METHODS) {
      builder[method] = (column?: unknown, value?: unknown) => {
        call.filters.push([method, column, value]);
        return builder;
      };
    }
    builder.single = async () => resolve();
    builder.maybeSingle = async () => resolve();
    // Awaiting the builder itself (no .single()) is how supabase-js returns lists.
    builder.then = (
      onFulfilled?: (v: ReturnType<typeof resolve>) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => Promise.resolve(resolve()).then(onFulfilled, onRejected);

    return builder;
  };

  return { calls, from } as unknown as FakeSupabase;
}

/** Calls that would change data — the assertion target for every rejection test. */
export function writes(client: FakeSupabase): FakeDbCall[] {
  return client.calls.filter((c) => c.op !== null && c.op !== "select");
}
