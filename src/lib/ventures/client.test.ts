import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The bug these exist to prevent, found 2026-09-09 by probing the live project:
 * COMMAND_CENTER_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL both point at
 * uapxakmlwnpfsftfeezx, and the COMMAND_CENTER key is revoked — it answers
 * `401 Unregistered API key` while the app's own service-role key answers 200.
 * A resolver that asks "are both variables set?" therefore picks a dead key for
 * a second connection to the database it is already attached to.
 *
 * So the question is identity, not presence.
 */
const h = vi.hoisted(() => ({ bridged: vi.fn(), own: vi.fn() }));
vi.mock("@/lib/command-center-bridge/client", () => ({
  createCommandCenterClient: h.bridged,
  isCommandCenterBridgeConfigured: () => true,
}));
vi.mock("@/lib/supabase-service", () => ({ tryCreateServiceRoleClient: h.own }));

const APP = "https://uapxakmlwnpfsftfeezx.supabase.co";
const saved = { ...process.env };

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import("@/lib/ventures/client");
}

beforeEach(() => {
  h.bridged.mockReturnValue({ tag: "bridge" });
  h.own.mockReturnValue({ tag: "own" });
});
afterEach(() => {
  process.env = { ...saved };
  vi.restoreAllMocks();
  h.bridged.mockReset();
  h.own.mockReset();
});

describe("resolveVentureDb", () => {
  it("ignores a bridge that points at this app's own project", async () => {
    const { resolveVentureDb, bridgeIsADifferentProject } = await load({
      NEXT_PUBLIC_SUPABASE_URL: APP,
      COMMAND_CENTER_SUPABASE_URL: APP,
      COMMAND_CENTER_SUPABASE_SERVICE_KEY: "sb_secret_revoked",
    });
    expect(bridgeIsADifferentProject()).toBe(false);
    expect(resolveVentureDb()).toEqual({ tag: "own" });
    expect(h.bridged).not.toHaveBeenCalled();
  });

  it("ignores it even when only the trailing slash differs", async () => {
    const { bridgeIsADifferentProject } = await load({
      NEXT_PUBLIC_SUPABASE_URL: APP,
      COMMAND_CENTER_SUPABASE_URL: APP + "/",
      COMMAND_CENTER_SUPABASE_SERVICE_KEY: "sb_secret_revoked",
    });
    expect(bridgeIsADifferentProject()).toBe(false);
  });

  it("uses the bridge when it really is a different project", async () => {
    const { resolveVentureDb, bridgeIsADifferentProject } = await load({
      NEXT_PUBLIC_SUPABASE_URL: APP,
      COMMAND_CENTER_SUPABASE_URL: "https://somewhereelse.supabase.co",
      COMMAND_CENTER_SUPABASE_SERVICE_KEY: "sb_secret_live",
    });
    expect(bridgeIsADifferentProject()).toBe(true);
    expect(resolveVentureDb()).toEqual({ tag: "bridge" });
  });

  it("falls back to the app's client when the bridge has a URL but no key", async () => {
    const { resolveVentureDb } = await load({
      NEXT_PUBLIC_SUPABASE_URL: APP,
      COMMAND_CENTER_SUPABASE_URL: "https://somewhereelse.supabase.co",
      COMMAND_CENTER_SUPABASE_SERVICE_KEY: undefined,
    });
    expect(resolveVentureDb()).toEqual({ tag: "own" });
  });

  it("a malformed bridge URL is not treated as a different project", async () => {
    const { bridgeIsADifferentProject } = await load({
      NEXT_PUBLIC_SUPABASE_URL: APP,
      COMMAND_CENTER_SUPABASE_URL: "not a url",
      COMMAND_CENTER_SUPABASE_SERVICE_KEY: "sb_secret_live",
    });
    expect(bridgeIsADifferentProject()).toBe(false);
  });

  it("with no bridge at all, the app's own client is used", async () => {
    const { resolveVentureDb } = await load({
      NEXT_PUBLIC_SUPABASE_URL: APP,
      COMMAND_CENTER_SUPABASE_URL: undefined,
      COMMAND_CENTER_SUPABASE_SERVICE_KEY: undefined,
    });
    expect(resolveVentureDb()).toEqual({ tag: "own" });
  });
});
