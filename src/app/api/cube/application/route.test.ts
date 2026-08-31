import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * These handlers run on a service-role client, so the database will not catch a
 * mistake here — the checks in the route are the only thing standing between a
 * request and someone's credit application. They shipped with none: GET returned
 * a whole application for any id in the query string and PUT upserted whatever
 * was posted, including the consent flags.
 *
 * Middleware bounces anonymous callers to /login, which is why this was easy to
 * miss — but middleware's tier rules put every signed-in account in the branch
 * that permits /api/cube/*, so "signed in as anyone" was the real exposure.
 * That is what these tests pin down: a session alone is not authorization.
 */

const guard = vi.hoisted(() => vi.fn());
const load = vi.hoisted(() => vi.fn());
const save = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/program-applications-server", () => ({
  fetchApplicationGuard: guard,
  loadProgramApplication: load,
  saveProgramApplication: save,
}));

vi.mock("@/lib/supabase-server", () => ({
  createSSRClient: async () => ({ auth: { getUser } }),
}));

import { GET, PUT } from "./route";

const APP_ID = "11111111-1111-1111-1111-111111111111";
const OWNER_EMAIL = "client@example.com";
const TOKEN = "s3cret-access-token";

/** The row exists and belongs to OWNER_EMAIL, guarded by TOKEN. */
function applicationExists() {
  guard.mockResolvedValue({ email: OWNER_EMAIL, accessToken: TOKEN });
}

function signedInAs(email: string, role?: string) {
  getUser.mockResolvedValue({
    data: {
      user: { email, app_metadata: role ? { role } : {} } as unknown as User,
    },
  });
}

function signedOut() {
  getUser.mockResolvedValue({ data: { user: null } });
}

const getReq = (qs: string) =>
  new NextRequest(`http://localhost/api/cube/application${qs}`);

const putReq = (id: string, qs = "") =>
  new NextRequest(`http://localhost/api/cube/application${qs}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      application: { id },
      currentUser: { email: "attacker@example.com" },
    }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  load.mockResolvedValue({ application: { id: APP_ID }, currentUser: {} });
  save.mockResolvedValue(undefined);
});

describe("GET /api/cube/application", () => {
  it("refuses a signed-in stranger, and does not load the application", async () => {
    applicationExists();
    signedInAs("stranger@example.com");

    const res = await GET(getReq(`?id=${APP_ID}`));

    expect(res.status).toBe(404);
    expect(load).not.toHaveBeenCalled();
  });

  it("refuses a signed-out caller with no token", async () => {
    applicationExists();
    signedOut();

    expect((await GET(getReq(`?id=${APP_ID}`))).status).toBe(404);
    expect(load).not.toHaveBeenCalled();
  });

  it("refuses a wrong token without falling back to an unchecked read", async () => {
    applicationExists();
    signedOut();

    const res = await GET(getReq(`?id=${APP_ID}&token=wrong-guess`));

    expect(res.status).toBe(404);
    expect(load).not.toHaveBeenCalled();
  });

  it("allows the access token minted with the row", async () => {
    applicationExists();
    signedOut();

    const res = await GET(getReq(`?id=${APP_ID}&token=${TOKEN}`));

    expect(res.status).toBe(200);
    expect(load).toHaveBeenCalledWith(APP_ID);
  });

  it("allows the person the application belongs to, case-insensitively", async () => {
    applicationExists();
    signedInAs("CLIENT@Example.com ");

    expect((await GET(getReq(`?id=${APP_ID}`))).status).toBe(200);
  });

  it("allows staff any application", async () => {
    applicationExists();
    signedInAs("va@tmmt.example", "internal_team");

    expect((await GET(getReq(`?id=${APP_ID}`))).status).toBe(200);
  });

  it("answers 404 for an unknown id, the same as for a forbidden one", async () => {
    guard.mockResolvedValue(null);
    signedInAs("va@tmmt.example", "internal_team");

    // Identical to the refusal above — a stranger must not be able to tell
    // which application ids exist.
    expect((await GET(getReq(`?id=${APP_ID}`))).status).toBe(404);
  });

  it("still rejects a missing id", async () => {
    expect((await GET(getReq(""))).status).toBe(400);
  });
});

describe("PUT /api/cube/application", () => {
  it("refuses a signed-in stranger, and writes nothing", async () => {
    applicationExists();
    signedInAs("attacker@example.com");

    const res = await PUT(putReq(APP_ID));

    expect(res.status).toBe(404);
    expect(save).not.toHaveBeenCalled();
  });

  it("does not let the posted body name its own authority", async () => {
    // The body claims to be the owner. Authorization must come from the session
    // or the token, never from the payload being written.
    applicationExists();
    signedOut();

    const req = new NextRequest("http://localhost/api/cube/application", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        application: { id: APP_ID },
        currentUser: { email: OWNER_EMAIL },
      }),
    });

    expect((await PUT(req)).status).toBe(404);
    expect(save).not.toHaveBeenCalled();
  });

  it("allows the owner to save their own application", async () => {
    applicationExists();
    signedInAs(OWNER_EMAIL);

    expect((await PUT(putReq(APP_ID))).status).toBe(200);
    expect(save).toHaveBeenCalledOnce();
  });

  it("allows a token holder to save", async () => {
    applicationExists();
    signedOut();

    expect((await PUT(putReq(APP_ID, `?token=${TOKEN}`))).status).toBe(200);
    expect(save).toHaveBeenCalledOnce();
  });

  it("still rejects a body with no application id", async () => {
    const req = new NextRequest("http://localhost/api/cube/application", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ application: {} }),
    });

    expect((await PUT(req)).status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });
});
