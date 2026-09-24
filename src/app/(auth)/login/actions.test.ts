import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeSupabase, writes, type FakeSupabase } from "@/lib/testing/fake-supabase";
import { hashInviteCode } from "@/lib/signup-invite";

/**
 * C3-001/002 — invite-gated sign-up, on fakes (no network).
 *   - no client-supplied metadata reaches the auth user
 *   - an already-registered email (Supabase's identity-less look-alike user) gives the
 *     invite BACK and records no used_by
 *   - confirmation-required sign-ups get "check your email", not a redirect
 *   - a revoked / used / expired / wrong-email invite is refused with one message
 */
const CODE = "ABCD-EFGH-JKMN-PQRS";
const state = vi.hoisted(() => ({
  invite: null as null | Record<string, unknown>,
  signUpResult: { data: { user: null, session: null }, error: null } as { data: { user: unknown; session: unknown }; error: null | { message: string } },
  signUpArgs: [] as unknown[],
  admin: null as unknown,
}));

vi.mock("next/headers", () => ({ headers: async () => new Map([["x-forwarded-for", "203.0.113.9"]]) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/rate-limit-durable", () => ({ isRateLimitedDurable: async () => false }));
vi.mock("@/lib/supabase-service", () => ({ createServiceRoleClient: () => state.admin }));
vi.mock("@/lib/supabase-server", () => ({
  createSSRClient: async () => ({
    auth: {
      signUp: async (args: unknown) => {
        state.signUpArgs.push(args);
        return state.signUpResult;
      },
    },
  }),
}));

import { signUp } from "./actions";

function admin(): FakeSupabase {
  state.admin = makeFakeSupabase((call) => {
    if (call.table === "signup_invites" && call.op === "select") {
      const hash = call.filters.find((f) => f[1] === "code_hash")?.[2];
      return { data: hash === hashInviteCode(CODE) ? state.invite : null };
    }
    if (call.table === "signup_invites" && call.op === "update") return { data: { id: "inv-1" } };
    return { error: null };
  });
  return state.admin as FakeSupabase;
}

const form = (over: Record<string, string> = {}) => {
  const fd = new FormData();
  fd.set("email", "new@example.test");
  fd.set("password", "correct horse battery");
  fd.set("fullName", "New Person");
  fd.set("inviteCode", CODE);
  for (const [k, v] of Object.entries(over)) fd.set(k, v);
  return fd;
};
const future = new Date(Date.now() + 86400000).toISOString();
const user = (identities: unknown[] = [{ id: "i" }]) => ({ id: "u-1", email: "new@example.test", app_metadata: {}, user_metadata: {}, identities });

beforeEach(() => {
  state.invite = { id: "inv-1", email: null, expires_at: future, used_at: null };
  state.signUpArgs = [];
  state.signUpResult = { data: { user: user(), session: { access_token: "t" } }, error: null };
});

describe("sign-up with an invite", () => {
  it("creates the login WITHOUT any client-supplied metadata, and writes the name server-side", async () => {
    const db = admin();
    await expect(signUp(form({ fullName: "Mallory", role: "admin" }))).rejects.toThrow(/NEXT_REDIRECT/);
    expect(state.signUpArgs).toEqual([{ email: "new@example.test", password: "correct horse battery" }]);
    const nameWrite = writes(db).find((w) => w.table === "profiles");
    expect(nameWrite?.payload).toEqual({ full_name: "Mallory" });
  });

  it("an already-registered email gives the invite back and records no used_by", async () => {
    const db = admin();
    state.signUpResult = { data: { user: user([]), session: null }, error: null };
    expect(await signUp(form())).toEqual({ error: "Could not create that login. Try signing in, or use another email." });
    const inviteWrites = writes(db).filter((w) => w.table === "signup_invites").map((w) => w.payload);
    expect(inviteWrites.some((p) => (p as { used_at?: unknown }).used_at === null)).toBe(true); // released
    expect(inviteWrites.some((p) => "used_by" in (p as object))).toBe(false);
    expect(writes(db).some((w) => w.table === "profiles")).toBe(false);
  });

  it("confirmation required: 'check your email', not a redirect into the app", async () => {
    admin();
    state.signUpResult = { data: { user: user(), session: null }, error: null };
    expect(await signUp(form())).toEqual({ error: "Check your email to confirm the account, then sign in." });
  });

  it.each([
    ["revoked", { status: "revoked", revoked_at: new Date().toISOString() }],
    ["used", { used_at: new Date().toISOString() }],
    ["expired", { expires_at: new Date(Date.now() - 1000).toISOString() }],
    ["wrong email", { email: "someone-else@example.test" }],
  ])("a %s invite is refused with the one generic message, before any account is made", async (_n, over) => {
    admin();
    state.invite = { ...state.invite!, ...over };
    expect(await signUp(form())).toEqual({ error: "That invite code isn't valid. Ask TMMT for a new one." });
    expect(state.signUpArgs).toHaveLength(0);
  });

  it("an unknown code is refused the same way", async () => {
    admin();
    expect(await signUp(form({ inviteCode: "ZZZZ-ZZZZ-ZZZZ-ZZZZ" }))).toEqual({ error: "That invite code isn't valid. Ask TMMT for a new one." });
    expect(state.signUpArgs).toHaveLength(0);
  });
});
