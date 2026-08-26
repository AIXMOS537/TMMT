import { headers } from "next/headers";
import {
  OPS_FALLBACK_SLUG,
  TENANT_HEADER,
  resolveTenant,
  type TenantBrand,
} from "./tenant-resolve";

export async function getRequestBrand(): Promise<TenantBrand> {
  const h = await headers();
  return resolveTenant({
    header: h.get(TENANT_HEADER),
    host: h.get("host"),
    forwardedHost: h.get("x-forwarded-host"),
    fallbackSlug: OPS_FALLBACK_SLUG,
  });
}
