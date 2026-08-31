"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
 */
export default function AnalyticsProvider() {
  const searchParams = useSearchParams();

  useEffect(() => {
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
  }, [searchParams]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
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
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
