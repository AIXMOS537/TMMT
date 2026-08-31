import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";

/**
 * authorizeApplicationAccess is the whole gate on a credit application.
 *
 * Both callers — the cube API and the document upload — run on a service-role
 * client, so RLS never sees their requests and this function is the only thing
 * standing between someone and another person's legal name, date of birth,
 * address, income and credit-score range. It used not to exist: the API took an
 * id from the query string and answered.
 *
 * These tests own the auth matrix. The route's own test file covers the
 * plumbing around it.
 */

const maybeSingle = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
  }),
}));

vi.mock("@/lib/supabase-server", () => ({
  createSSRClient: async () => ({ auth: { getUser } }),
}));

import { authorizeApplicationAccess } from "./program-applications-server";

const APP_ID = "11111111-1111-1111-1111-111111111111";
const OWNER_EMAIL = "client@example.com";
const TOKEN = "s3cret-access-token";

function applicationExists() {
  maybeSingle.mockResolvedValue({
    data: { email: OWNER_EMAIL, access_token: TOKEN },
  });
}

function signedInAs(email: string, role?: string) {
  getUser.mockResolvedValue({
    data: { user: { id: "u1", email, app_metadata: role ? { role } : {} } as unknown as User },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  getUser.mockResolvedValue({ data: { user: null } });
});

describe("authorizeApplicationAccess", () => {
  it("denies an unknown application, whoever is asking", async () => {
    maybeSingle.mockResolvedValue({ data: null });
    signedInAs("va@tmmt.example", "internal_team");

    expect(await authorizeApplicationAccess(APP_ID, TOKEN)).toEqual({ ok: false });
  });

  it("denies a signed-in stranger", async () => {
    applicationExists();
    signedInAs("stranger@example.com");

    expect(await authorizeApplicationAccess(APP_ID, null)).toEqual({ ok: false });
  });

  it("denies a signed-out caller with no token", async () => {
    applicationExists();

    expect(await authorizeApplicationAccess(APP_ID, null)).toEqual({ ok: false });
  });

  it("denies a wrong token", async () => {
    applicationExists();

    expect(await authorizeApplicationAccess(APP_ID, "wrong-guess")).toEqual({ ok: false });
  });

  it("allows the access token, without a session, and not as staff", async () => {
    applicationExists();

    const access = await authorizeApplicationAccess(APP_ID, TOKEN);
    expect(access).toMatchObject({ ok: true, staff: false, userId: null });
  });

  it("allows the owner of the application, case- and space-insensitively", async () => {
    applicationExists();
    signedInAs("  CLIENT@Example.com ");

    expect(await authorizeApplicationAccess(APP_ID, null)).toMatchObject({
      ok: true,
      staff: false,
    });
  });

  it("allows staff any application, and says so", async () => {
    applicationExists();
    signedInAs("va@tmmt.example", "internal_team");

    expect(await authorizeApplicationAccess(APP_ID, null)).toMatchObject({
      ok: true,
      staff: true,
    });
  });

  it("does not treat a customer role as staff", async () => {
    applicationExists();
    signedInAs("someone@example.com", "customer");

    expect(await authorizeApplicationAccess(APP_ID, null)).toEqual({ ok: false });
  });

  it("does not match on an empty stored token", async () => {
    // A row with no access_token must not be unlocked by sending no token, or
    // by sending an empty one.
    maybeSingle.mockResolvedValue({ data: { email: OWNER_EMAIL, access_token: null } });

    expect(await authorizeApplicationAccess(APP_ID, "")).toEqual({ ok: false });
    expect(await authorizeApplicationAccess(APP_ID, "anything")).toEqual({ ok: false });
  });

  it("does not match an application whose email is null against a session", async () => {
    maybeSingle.mockResolvedValue({ data: { email: null, access_token: TOKEN } });
    signedInAs("client@example.com");

    expect(await authorizeApplicationAccess(APP_ID, null)).toEqual({ ok: false });
  });
});
