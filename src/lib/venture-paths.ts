/** Pure URL helpers — safe for client components. */
export function ventureHref(ventureSlug: string, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return `/v/${ventureSlug}`;
  return `/v/${ventureSlug}${normalized}`;
}
