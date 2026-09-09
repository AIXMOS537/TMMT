/**
 * Per-tenant webhook secret lookup for the `[slug]` webhook routes (T-02c).
 *
 * The Stripe and Cal.com routes hold each tenant's webhook secret in env as
 * `<PREFIX>_<SLUG>` (slug upper-cased, dashes to underscores). Before T-02c a
 * missing variable answered 500 BEFORE the signature check, so an unsigned
 * probe could tell a configured slug (401) from an unconfigured one (500).
 *
 * Now a missing secret is indistinguishable from a bad signature on the wire
 * — the route answers the same 401 body — and the misconfiguration is
 * reported server-side as one structured `console.error` line per attempt,
 * in the `[degraded]` style of `src/lib/degraded.ts`, so the owner can grep
 * for it. It is not routed through `reportDegraded` itself: that module
 * tracks a component falling back to a substitute, throttled per component,
 * and would collapse two misconfigured slugs into one line and one health
 * entry. A missing tenant secret is a per-slug configuration fault, not a
 * fallback.
 */
export const WEBHOOK_MISCONFIG_PREFIX = "[webhook-misconfig] ";

export function tenantWebhookEnvKey(prefix: string, slug: string): string {
  return `${prefix}_${slug.toUpperCase().replace(/-/g, "_")}`;
}

/**
 * The tenant's secret, or null (already logged) when `<prefix>_<SLUG>` is unset.
 * Callers MUST answer null with the same response a bad signature gets.
 */
export function resolveTenantWebhookSecret(route: string, prefix: string, slug: string): string | null {
  const envKey = tenantWebhookEnvKey(prefix, slug);
  const secret = process.env[envKey];
  if (secret) return secret;
  try {
    console.error(
      `${WEBHOOK_MISCONFIG_PREFIX}${JSON.stringify({
        route,
        slug,
        envKey,
        reason: "tenant webhook secret not configured; answered 401 as a bad signature",
      })}`
    );
  } catch {
    // A logger that throws must not change the response.
  }
  return null;
}
