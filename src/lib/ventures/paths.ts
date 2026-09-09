/** Pure URL helpers for venture-scoped routes — safe in client components. */
export function ventureHref(ventureSlug: string, path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/" ? `/v/${ventureSlug}` : `/v/${ventureSlug}${normalized}`;
}
