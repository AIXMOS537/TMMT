// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

/**
 * The claim under test is not "analytics works". It is "analytics failing
 * cannot take the page down with it".
 *
 * This component lives in the root layout, so an uncaught throw from one of
 * its effects unwinds to the global error boundary and replaces every page in
 * the app with "Something went wrong" — after the correct HTML has already
 * been delivered. The realistic trigger is a build that ran without
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY, which exits 0 and
 * deploys green while shipping a bundle whose first `supabase.auth` access
 * throws on every route.
 */

const analytics = vi.hoisted(() => ({
  initAnalytics: vi.fn(),
  registerAttribution: vi.fn(),
  resetAnalytics: vi.fn(),
  identifyUser: vi.fn(),
  trackEvent: vi.fn(),
}));

const supa = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  /** When true, touching `supabase.auth` throws, exactly as the real proxy does. */
  authAccessThrows: false,
}));

vi.mock("@/lib/analytics", () => analytics);
vi.mock("@/lib/auth-roles", () => ({ getTierForUser: () => "owner" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("utm_source=test"),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    get auth() {
      if (supa.authAccessThrows) {
        throw new Error(
          "Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
        );
      }
      return { onAuthStateChange: supa.onAuthStateChange };
    },
  },
}));

import AnalyticsProvider from "./AnalyticsProvider";

let errorSpy: ReturnType<typeof vi.spyOn>;

function subscription() {
  return { data: { subscription: { unsubscribe: vi.fn() } } };
}

beforeEach(() => {
  vi.clearAllMocks();
  supa.authAccessThrows = false;
  supa.onAuthStateChange.mockReturnValue(subscription());
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("a missing build-time env var must not white-screen the app", () => {
  it("renders anyway when touching supabase.auth throws", () => {
    supa.authAccessThrows = true;
    expect(() => render(<AnalyticsProvider />)).not.toThrow();
  });

  it("says so loudly rather than swallowing it", () => {
    supa.authAccessThrows = true;
    render(<AnalyticsProvider />);
    const logged = errorSpy.mock.calls.map((c) => String(c[0])).join(" ");
    expect(logged).toContain("[analytics]");
  });

  it("renders anyway when the analytics SDK itself throws on init", () => {
    analytics.initAnalytics.mockImplementationOnce(() => {
      throw new Error("third-party script blocked");
    });
    expect(() => render(<AnalyticsProvider />)).not.toThrow();
  });

  it("renders anyway when subscribing fails for any other reason", () => {
    supa.onAuthStateChange.mockImplementationOnce(() => {
      throw new Error("network down");
    });
    expect(() => render(<AnalyticsProvider />)).not.toThrow();
  });
});

describe("the auth callback runs on someone else's stack", () => {
  it("does not let a throw inside it escape", () => {
    analytics.identifyUser.mockImplementationOnce(() => {
      throw new Error("identify blew up");
    });
    render(<AnalyticsProvider />);

    const handler = supa.onAuthStateChange.mock.calls[0][0] as (
      e: string,
      s: unknown,
    ) => void;
    // Supabase invokes this later, outside our try block. If the guard were
    // only around the subscribe call, this would throw into their listener.
    expect(() => handler("SIGNED_IN", { user: { id: "u1" } })).not.toThrow();
  });
});

describe("unmount", () => {
  it("does not throw when there was never a subscription to clean up", () => {
    supa.authAccessThrows = true;
    const { unmount } = render(<AnalyticsProvider />);
    expect(() => unmount()).not.toThrow();
  });

  it("does not throw when unsubscribe itself fails", () => {
    supa.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: () => {
            throw new Error("already gone");
          },
        },
      },
    });
    const { unmount } = render(<AnalyticsProvider />);
    expect(() => unmount()).not.toThrow();
  });
});

describe("positive control — the guards must not have turned it into a no-op", () => {
  // Without this, a component whose body was deleted entirely would pass every
  // test above. These assert it still does the job when nothing is broken.
  it("still starts analytics and subscribes on the happy path", () => {
    render(<AnalyticsProvider />);
    expect(analytics.initAnalytics).toHaveBeenCalled();
    expect(supa.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("still records attribution from the query string", () => {
    render(<AnalyticsProvider />);
    expect(analytics.registerAttribution).toHaveBeenCalledWith({ utm_source: "test" });
  });

  it("still identifies a signed-in user", () => {
    render(<AnalyticsProvider />);
    const handler = supa.onAuthStateChange.mock.calls[0][0] as (
      e: string,
      s: unknown,
    ) => void;
    handler("SIGNED_IN", { user: { id: "u1" } });
    expect(analytics.identifyUser).toHaveBeenCalled();
    expect(analytics.trackEvent).toHaveBeenCalledWith("user_signed_in", expect.anything());
  });

  it("still resets on sign-out", () => {
    render(<AnalyticsProvider />);
    const handler = supa.onAuthStateChange.mock.calls[0][0] as (
      e: string,
      s: unknown,
    ) => void;
    handler("SIGNED_OUT", null);
    expect(analytics.resetAnalytics).toHaveBeenCalled();
  });
});
