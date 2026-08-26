/**
 * Resolves which tenant brand a request belongs to.
 * Edge-safe: only imports the generated map (no node:fs).
 */
import {
  TENANTS,
  TENANT_ALIASES,
  TENANT_HOSTS,
  DEFAULT_TENANT_SLUG,
  type TenantBrand,
} from "./tenant-map.generated";

export type { TenantBrand };
export { TENANTS, DEFAULT_TENANT_SLUG };

export const TENANT_HEADER = "x-aixmos-tenant";
export const OPS_FALLBACK_SLUG = "tmmt_property";

const NON_TENANT_LABELS = new Set(["www", "app", "api", "admin", "staging", "preview"]);

export function normalizeHost(host: string | null | undefined): string {
  return String(host ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

export function canonicalSlug(input: string | null | undefined): string | undefined {
  const key = String(input ?? "").trim().toLowerCase();
  if (!key) return undefined;
  if (TENANTS[key]) return key;
  return TENANT_ALIASES[key];
}

export function resolveTenantBySlug(
  input: string | null | undefined,
): TenantBrand | undefined {
  const slug = canonicalSlug(input);
  return slug ? TENANTS[slug] : undefined;
}

export function resolveTenantByHost(
  host: string | null | undefined,
): TenantBrand | undefined {
  const clean = normalizeHost(host);
  if (!clean) return undefined;
  const exact = TENANT_HOSTS[clean];
  if (exact && TENANTS[exact]) return TENANTS[exact];
  const labels = clean.split(".");
  if (labels.length < 2) return undefined;
  const label = labels[0];
  if (NON_TENANT_LABELS.has(label)) return undefined;
  return resolveTenantBySlug(label);
}

export function resolveTenantByPath(
  pathname: string | null | undefined,
): TenantBrand | undefined {
  const segments = String(pathname ?? "")
    .split("/")
    .filter(Boolean);
  if (segments.length < 2 || segments[0] !== "lp") return undefined;
  return resolveTenantBySlug(segments[1]);
}

export function tenantOrDefault(
  input: string | null | undefined,
  fallbackSlug: string = DEFAULT_TENANT_SLUG,
): TenantBrand {
  return (
    resolveTenantBySlug(input) ??
    resolveTenantBySlug(fallbackSlug) ??
    TENANTS[DEFAULT_TENANT_SLUG]
  );
}

export type TenantRequestHints = {
  slug?: string | null;
  header?: string | null;
  host?: string | null;
  forwardedHost?: string | null;
  pathname?: string | null;
  fallbackSlug?: string;
};

export function resolveTenant(hints: TenantRequestHints): TenantBrand {
  return (
    resolveTenantBySlug(hints.slug) ??
    resolveTenantBySlug(hints.header) ??
    resolveTenantByHost(hints.forwardedHost) ??
    resolveTenantByHost(hints.host) ??
    resolveTenantByPath(hints.pathname) ??
    tenantOrDefault(hints.fallbackSlug)
  );
}
