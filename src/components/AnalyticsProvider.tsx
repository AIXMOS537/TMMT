"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getTierForUser } from "@/lib/auth-roles";
import {
  identifyUser,
  initAnalytics,
  registerAttribution,
  resetAnalytics,
  trackEvent,
} from "@/lib/analytics";

const ATTRIBUTION_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/**
 * Renders nothing — it exists for its effects. Deliberately does NOT wrap the
 * tree: useSearchParams() forces this into a Suspense boundary, and anything
 * inside that boundary flushes the response shell before it renders, which
 * locks the HTTP status at 200. When this wrapped {children}, every notFound()
 * in the app returned "200 OK" with 404 content — invisible to uptime checks
 * and indexable by Google. Keep it a sibling of {children}, not a parent.
 *
 * Nothing in here is allowed to throw, and that is the other half of the job.
 *
 * This component sits in the root layout, so it runs on all 143 routes. An
 * error thrown from one of its effects is not contained to analytics — React
 * unwinds to the nearest error boundary, which here is the global one, and the
 * visitor gets "Something went wrong" instead of the page. The server HTML had
 * already rendered correctly; the page is replaced after it arrives.
 *
 * That is not hypothetical. Build this app without NEXT_PUBLIC_SUPABASE_URL
 * and NEXT_PUBLIC_SUPABASE_ANON_KEY and `supabase.auth` throws on first access
 * below. Every public page — the fourteen money CTAs, every intake form, the
 * rental front door — white-screens. The build still exits 0 and the deploy
 * still goes green, because those values are inlined into the client bundle at
 * BUILD time: a runtime environment fix cannot rescue a bundle built without
 * them, and nothing in the build fails to warn you.
 *
 * So every effect here degrades instead of throwing. Losing analytics costs us
 * some attribution data. Losing the storefront costs us the customer. The
 * failures are still logged loudly — a swallowed error that nobody can see is
 * the thing we keep finding in other people's code, and this must not become
 * another one.
 */
export default function AnalyticsProvider() {
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      initAnalytics();

      const params = new URLSearchParams(searchParams.toString());
      const attribution: Record<string, string> = {};
      for (const key of ATTRIBUTION_PARAMS) {
        const value = params.get(key);
        if (value) attribution[key] = value;
      }
      if (Object.keys(attribution).length > 0) {
        registerAttribution(attribution);
      }
    } catch (err) {
      console.error("[analytics] attribution failed; continuing without it", err);
    }
  }, [searchParams]);

  useEffect(() => {
    // The callback runs later, on Supabase's stack rather than ours, so a throw
    // in here would not be caught by the try below. It gets its own guard.
    const onAuthChange = (event: AuthChangeEvent, session: Session | null) => {
      try {
        const user = session?.user ?? null;

        if (event === "SIGNED_OUT") {
          resetAnalytics();
          return;
        }

        if (!user) return;

        identifyUser(user);

        if (event === "SIGNED_IN") {
          trackEvent("user_signed_in", {
            sign_in_method: "email",
            platform: "web",
            access_tier: getTierForUser(user),
          });
        }
      } catch (err) {
        console.error("[analytics] auth event not recorded", err);
      }
    };

    let unsubscribe: (() => void) | null = null;
    try {
      // First property access on the lazy `supabase` proxy. This is the line
      // that throws when the public env vars were missing at build time.
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(onAuthChange);
      unsubscribe = () => subscription.unsubscribe();
    } catch (err) {
      console.error(
        "[analytics] could not subscribe to auth changes; the page still works, analytics does not",
        err,
      );
    }

    return () => {
      try {
        unsubscribe?.();
      } catch (err) {
        console.error("[analytics] unsubscribe failed", err);
      }
    };
  }, []);

  return null;
}
