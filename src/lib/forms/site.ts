import { headers } from "next/headers";
import type { FormSite } from "./catalog";
import { isTmmtPublicHost, normalizeHost } from "@/lib/site-domains";

export type { FormSite };

export function siteFromHost(host: string | null | undefined, forwardedHost?: string | null): FormSite {
  const fwd = normalizeHost(forwardedHost ?? null);
  const h = normalizeHost(host ?? null);
  const probe = fwd || h;
  if (probe.includes("aixmos-landing") || probe === "aixmos.com" || probe === "www.aixmos.com") {
    return "aixmos";
  }
  if (isTmmtPublicHost(host ?? null) || isTmmtPublicHost(forwardedHost ?? null)) return "tmmt";
  if (probe.includes("aixmos")) return "aixmos";
  return "tmmt";
}

export function siteFromSearchParam(raw: string | string[] | undefined): FormSite | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "aixmos" || v === "tmmt") return v;
  return null;
}

export async function resolveFormSite(searchSite?: string | string[]): Promise<FormSite> {
  const fromQuery = siteFromSearchParam(searchSite);
  if (fromQuery) return fromQuery;
  const h = await headers();
  return siteFromHost(h.get("host"), h.get("x-forwarded-host"));
}
