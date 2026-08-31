import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * These handlers run on a service-role client, so the database will not catch a
 * mistake here — whether the gate is consulted at all is the whole safety
 * property. They shipped without one: GET returned a complete application for
 * any id in the query string and PUT upserted whatever was posted, including
 * client_consent_given.
 *
 * The gate's own rules live in src/lib/program-applications-server.test.ts.
 * What this file pins down is the wiring: that every path asks first, that a
 * refusal reaches nothing, and that a refusal is indistinguishable from an
 * application that does not exist.
 */

const authorize = vi.hoisted(() => vi.fn());
const load = vi.hoisted(() => vi.fn());
const save = vi.hoisted(() => vi.fn());

vi.mock("@/lib/program-applications-server", () => ({
  authorizeApplicationAccess: authorize,
  loadProgramApplication: load,
  saveProgramApplication: save,
}));

import { GET, PUT } from "./route";

const APP_ID = "11111111-1111-1111-1111-111111111111";
const TOKEN = "s3cret-access-token";

const allow = () => authorize.mockResolvedValue({ ok: true, staff: false, userId: "u1" });
const deny = () => authorize.mockResolvedValue({ ok: false });

const getReq = (qs: string) =>
  new NextRequest(`http://localhost/api/cube/application${qs}`);

const putReq = (id: unknown, qs = "") =>
  new NextRequest(`http://localhost/api/cube/application${qs}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      application: id === undefined ? {} : { id },
      currentUser: { email: "attacker@example.com" },
    }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  load.mockResolvedValue({ application: { id: APP_ID }, currentUser: {} });
  save.mockResolvedValue(undefined);
});

describe("GET /api/cube/application", () => {
  it("does not load the application when access is refused", async () => {
    deny();

    const res = await GET(getReq(`?id=${APP_ID}`));

    expect(res.status).toBe(404);
    expect(load).not.toHaveBeenCalled();
  });

  it("passes the id and the token from the query string to the gate", async () => {
    allow();

    await GET(getReq(`?id=${APP_ID}&token=${TOKEN}`));

    expect(authorize).toHaveBeenCalledWith(APP_ID, TOKEN);
  });

  it("asks the gate even when no token is supplied", async () => {
    allow();

    await GET(getReq(`?id=${APP_ID}`));

    expect(authorize).toHaveBeenCalledWith(APP_ID, null);
  });

  it("returns the application once access is granted", async () => {
    allow();

    const res = await GET(getReq(`?id=${APP_ID}`));

    expect(res.status).toBe(200);
    expect(load).toHaveBeenCalledWith(APP_ID);
  });

  it("answers 404 for an application that resolves to nothing, same as a refusal", async () => {
    // Identical status to the refusal above — a stranger must not be able to
    // tell which application ids exist.
    allow();
    load.mockResolvedValue(null);

    expect((await GET(getReq(`?id=${APP_ID}`))).status).toBe(404);
  });

  it("rejects a missing id before asking anything", async () => {
    expect((await GET(getReq(""))).status).toBe(400);
    expect(authorize).not.toHaveBeenCalled();
  });
});

describe("PUT /api/cube/application", () => {
  it("writes nothing when access is refused", async () => {
    deny();

    const res = await PUT(putReq(APP_ID));

    expect(res.status).toBe(404);
    expect(save).not.toHaveBeenCalled();
  });

  it("authorizes the id in the body, not anything else in it", async () => {
    allow();

    await PUT(putReq(APP_ID));

    expect(authorize).toHaveBeenCalledWith(APP_ID, null);
  });

  it("takes the token from the query string, never from the body", async () => {
    // The body is the thing being authorized, so it cannot also be what
    // authorizes it.
    allow();

    await PUT(putReq(APP_ID, `?token=${TOKEN}`));

    expect(authorize).toHaveBeenCalledWith(APP_ID, TOKEN);
  });

  it("saves once access is granted", async () => {
    allow();

    expect((await PUT(putReq(APP_ID))).status).toBe(200);
    expect(save).toHaveBeenCalledOnce();
  });

  it("rejects a body with no application id before asking anything", async () => {
    expect((await PUT(putReq(undefined))).status).toBe(400);
    expect(authorize).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    const req = new NextRequest("http://localhost/api/cube/application", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not json",
    });

    expect((await PUT(req)).status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });
});
