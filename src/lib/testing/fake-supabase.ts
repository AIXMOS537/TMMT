import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Minimal recording double for the supabase-js query builder, for route and
 * server-action tests.
 *
 * Every `from(table)` opens one FakeDbCall. Builder methods record what the
 * route asked for (op, payload, filters) and return the same builder, so any
 * chain the real code writes (`.insert().select().single()`,
 * `.update().eq()`, `.select().ilike().limit()` awaited directly) resolves
 * through the single `respond` callback. Nothing here talks to a network.
 *
 * Tests assert on `client.calls` — the whole point of T-02 is "did a rejected
 * request reach the database?", and that is answered by an empty `calls` list.
 *
 * T-03 (server-action authz) added three more surfaces the actions use:
 *   - `rpc(name, args)` — recorded as a call with table `rpc:<name>` and op
 *     "rpc", so a rejected caller that reaches an RPC still shows up in
 *     `writes()`. Awaitable and chainable like a builder.
 *   - `auth.getUser()` — returns the `user` given in options (null = anonymous).
 *   - `storage.from(bucket)` — `upload`/`remove`/`createSignedUrl` recorded in
 *     `client.storageCalls`; responses come from `storageRespond` or default
 *     to success.
 */
export type FakeDbCall = {
  table: string;
  op: "select" | "insert" | "upsert" | "update" | "delete" | "rpc" | null;
  payload?: unknown;
  options?: unknown;
  columns?: string;
  /** [method, column, value] in call order, e.g. ["eq", "id", "lead-1"]. */
  filters: Array<[string, unknown, unknown]>;
};

export type FakeStorageCall = {
  bucket: string;
  op: "upload" | "remove" | "createSignedUrl";
  args: unknown[];
};

export type FakeDbError = { code?: string; message: string };
export type FakeDbResponse = { data?: unknown; error?: FakeDbError | null };
export type FakeDbResponder = (call: FakeDbCall) => FakeDbResponse | undefined;
export type FakeStorageResponder = (call: FakeStorageCall) => FakeDbResponse | undefined;

export type FakeSupabaseOptions = {
  /** The signed-in user `auth.getUser()` reports; omit or null for anonymous. */
  user?: Partial<User> | null;
  storageRespond?: FakeStorageResponder;
};

export type FakeSupabase = SupabaseClient & {
  calls: FakeDbCall[];
  storageCalls: FakeStorageCall[];
};

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

export function makeFakeSupabase(
  respond: FakeDbResponder = () => undefined,
  options: FakeSupabaseOptions = {}
): FakeSupabase {
  const calls: FakeDbCall[] = [];
  const storageCalls: FakeStorageCall[] = [];

  const open = (call: FakeDbCall) => {
    calls.push(call);

    const resolve = () => {
      const r = respond(call) ?? {};
      return { data: r.data ?? null, error: r.error ?? null };
    };

    const builder: Record<string, unknown> = {};
    const mutation =
      (op: Exclude<FakeDbCall["op"], null | "select" | "rpc">) =>
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
    // `.not(column, operator, value)` carries three arguments; keep the
    // operator beside the value so a test can still match on the column.
    builder.not = (column?: unknown, operator?: unknown, value?: unknown) => {
      call.filters.push(["not", column, { operator, value }]);
      return builder;
    };
    builder.single = async () => resolve();
    builder.maybeSingle = async () => resolve();
    // Awaiting the builder itself (no .single()) is how supabase-js returns lists.
    builder.then = (
      onFulfilled?: (v: ReturnType<typeof resolve>) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => Promise.resolve(resolve()).then(onFulfilled, onRejected);

    return builder;
  };

  const from = (table: string) => open({ table, op: null, filters: [] });
  const rpc = (name: string, args?: unknown) =>
    open({ table: `rpc:${name}`, op: "rpc", payload: args, filters: [] });

  const auth = {
    getUser: async () => ({ data: { user: options.user ?? null }, error: null }),
  };

  const storage = {
    from: (bucket: string) => {
      const record = (op: FakeStorageCall["op"]) =>
        async (...args: unknown[]) => {
          const call: FakeStorageCall = { bucket, op, args };
          storageCalls.push(call);
          const r = options.storageRespond?.(call) ?? {};
          const defaultData =
            op === "createSignedUrl"
              ? { signedUrl: `https://storage.example.com/${bucket}/signed` }
              : op === "upload"
                ? { path: args[0] }
                : [];
          return { data: r.data ?? defaultData, error: r.error ?? null };
        };
      return {
        upload: record("upload"),
        remove: record("remove"),
        createSignedUrl: record("createSignedUrl"),
      };
    },
  };

  return { calls, storageCalls, from, rpc, auth, storage } as unknown as FakeSupabase;
}

/** Calls that would change data — the assertion target for every rejection test. */
export function writes(client: FakeSupabase): FakeDbCall[] {
  return client.calls.filter((c) => c.op !== null && c.op !== "select");
}
