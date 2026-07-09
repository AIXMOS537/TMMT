import mixpanel from "mixpanel-browser";
import type { User } from "@supabase/supabase-js";
import { getAppRole, getTierForUser } from "@/lib/auth-roles";

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

let initialized = false;

function canTrack(): boolean {
  return typeof window !== "undefined" && Boolean(TOKEN);
}

export function initAnalytics(): void {
  if (initialized || !canTrack()) return;

  mixpanel.init(TOKEN!, {
    debug: process.env.NODE_ENV !== "production",
    persistence: "localStorage",
    autocapture: true,
    record_sessions_percent: 100,
    ignore_dnt: false,
  });

  mixpanel.register({
    platform: "web",
    app: "tmmt",
  });

  initialized = true;
}

export function trackEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!canTrack()) return;
  if (!initialized) initAnalytics();
  mixpanel.track(event, properties);
}

export function identifyUser(user: User): void {
  if (!canTrack()) return;
  if (!initialized) initAnalytics();

  mixpanel.identify(user.id);

  const role = getAppRole(user);
  const tier = getTierForUser(user);
  const pocketMember = user.app_metadata?.pocket_member === true;

  mixpanel.people.set({
    $email: user.email,
    role,
    access_tier: tier,
    pocket_member: pocketMember,
  });

  mixpanel.register({
    user_role: role,
    access_tier: tier,
    pocket_member: pocketMember,
  });
}

export function resetAnalytics(): void {
  if (!canTrack() || !initialized) return;
  mixpanel.reset();
}

export function registerAttribution(properties: Record<string, string>): void {
  if (!canTrack()) return;
  if (!initialized) initAnalytics();
  mixpanel.register_once(properties);
}
