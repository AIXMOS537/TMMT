#!/usr/bin/env node
/**
 * brand-sync — compiles config/platform/tenants/*.json into:
 *   1. src/lib/platform/tenant-map.generated.ts  (edge- and browser-safe brand map)
 *   2. public/brands/<id>/{logo,mark,favicon}.svg (placeholder art per tenant)
 *
 * Placeholder art is stamped with GENERATED_MARKER. A tenant that ships real
 * artwork overwrites the file; the marker disappears and this script will never
 * touch it again — that is what makes client logos permanent.
 *
 * Usage: npm run brand:sync [-- --check]
 */
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TENANT_DIR = join(REPO_ROOT, "config", "platform", "tenants");
const OUT_TS = join(REPO_ROOT, "src", "lib", "platform", "tenant-map.generated.ts");
const BRANDS_DIR = join(REPO_ROOT, "public", "brands");
const GENERATED_MARKER = "aixmos:generated-placeholder";
const CHECK_ONLY = process.argv.includes("--check");
// Git checks files out with CRLF on Windows (core.autocrlf); the generator emits LF.
// Compare content, not line endings, or every Windows checkout reads as stale.
const sameText = (a, b) => (a ?? "").replace(/\r\n/g, "\n") === (b ?? "").replace(/\r\n/g, "\n");

const FALLBACK_THEME = {
  mode: "dark",
  primary: "#7fffd4",
  accent: "#6366f1",
  background: "#0a0a0a",
  foreground: "#ffffff",
};

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function initialsFor(displayName) {
  const words = String(displayName).trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? "X").slice(0, 2).toUpperCase();
}

function parseHex(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function luminance(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const chan = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
}

function contrastOn(hex) {
  return luminance(hex) > 0.45 ? "#000000" : "#ffffff";
}

function normalizeHost(host) {
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

function loadTenants() {
  if (!existsSync(TENANT_DIR)) throw new Error(`tenant config dir not found: ${TENANT_DIR}`);
  const tenants = [];
  for (const file of readdirSync(TENANT_DIR).sort()) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    let raw;
    try {
      raw = JSON.parse(readFileSync(join(TENANT_DIR, file), "utf8"));
    } catch (err) {
      throw new Error(`${file}: invalid JSON — ${err.message}`);
    }
    for (const field of ["id", "slug", "displayName"]) {
      if (!raw[field] || typeof raw[field] !== "string") {
        throw new Error(`${file}: missing required string field "${field}"`);
      }
    }
    const theme = { ...FALLBACK_THEME, ...(raw.theme ?? {}) };
    for (const key of ["primary", "accent", "background", "foreground"]) {
      if (!parseHex(theme[key])) {
        throw new Error(`${file}: theme.${key} is not a hex color (got ${JSON.stringify(theme[key])})`);
      }
    }
    if (theme.mode !== "dark" && theme.mode !== "light") theme.mode = "dark";

    const assetDir = `/brands/${raw.id}`;
    for (const key of ["logoPath", "markPath", "faviconPath"]) {
      const declared = theme[key];
      if (!declared) continue;
      if (!declared.startsWith(`${assetDir}/`) || !declared.endsWith(".svg")) {
        throw new Error(
          `${file}: theme.${key} must be "${assetDir}/<name>.svg" (got ${JSON.stringify(declared)}). ` +
            `Brand assets are generated into public${assetDir}/.`,
        );
      }
    }

    tenants.push({
      id: raw.id,
      slug: raw.slug,
      aliases: Array.isArray(raw.aliases) ? raw.aliases.filter((a) => typeof a === "string") : [],
      displayName: raw.displayName,
      legalName: typeof raw.legalName === "string" && raw.legalName ? raw.legalName : raw.displayName,
      tagline: typeof raw.tagline === "string" ? raw.tagline : "",
      initials: initialsFor(raw.displayName),
      theme: {
        mode: theme.mode,
        primary: theme.primary,
        accent: theme.accent,
        background: theme.background,
        foreground: theme.foreground,
        logoPath: theme.logoPath ?? `${assetDir}/logo.svg`,
        markPath: theme.markPath ?? `${assetDir}/mark.svg`,
        faviconPath: theme.faviconPath ?? `${assetDir}/favicon.svg`,
      },
      domains: {
        marketing: raw.domains?.marketing ? normalizeHost(raw.domains.marketing) : undefined,
        app: raw.domains?.app ? normalizeHost(raw.domains.app) : undefined,
      },
      licenseTier: raw.whiteLabel?.licenseTier ?? "tenant",
    });
  }
  if (tenants.length === 0) throw new Error("no tenant configs found");

  const claimed = new Map();
  for (const t of tenants) {
    for (const key of [t.slug, ...t.aliases]) {
      const owner = claimed.get(key);
      if (owner && owner !== t.slug) {
        throw new Error(`slug/alias collision: "${key}" claimed by both ${owner} and ${t.slug}`);
      }
      claimed.set(key, t.slug);
    }
  }
  return tenants;
}

function logoSvg(t) {
  const { primary, accent, foreground } = t.theme;
  const name = xmlEscape(t.displayName);
  const ink = contrastOn(primary);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 48" width="240" height="48" role="img" aria-label="${name}">
  <!-- ${GENERATED_MARKER}: replace this file with the tenant's real logo; brand-sync will never overwrite it again. -->
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${primary}"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="48" height="48" rx="12" fill="url(#g)"/>
  <text x="24" y="24" fill="${ink}" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="19" font-weight="700" text-anchor="middle" dominant-baseline="central">${xmlEscape(t.initials)}</text>
  <text x="62" y="24" fill="${foreground}" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="18" font-weight="600" letter-spacing="0.4" dominant-baseline="central">${name}</text>
</svg>
`;
}

function markSvg(t, size) {
  const { primary, accent } = t.theme;
  const ink = contrastOn(primary);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="${xmlEscape(t.displayName)}">
  <!-- ${GENERATED_MARKER}: replace this file with the tenant's real mark; brand-sync will never overwrite it again. -->
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${primary}"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="64" height="64" rx="16" fill="url(#g)"/>
  <text x="32" y="33" fill="${ink}" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="26" font-weight="700" text-anchor="middle" dominant-baseline="central">${xmlEscape(t.initials)}</text>
</svg>
`;
}

function syncBrandAssets(t, report) {
  const dir = join(BRANDS_DIR, t.id);
  const assets = [
    [basename(t.theme.logoPath), () => logoSvg(t)],
    [basename(t.theme.markPath), () => markSvg(t, 64)],
    [basename(t.theme.faviconPath), () => markSvg(t, 32)],
  ];
  const logoName = basename(t.theme.logoPath);
  let custom = false;
  for (const [name, render] of assets) {
    const path = join(dir, name);
    if (existsSync(path)) {
      const body = readFileSync(path, "utf8");
      if (!body.includes(GENERATED_MARKER)) {
        if (name === logoName) custom = true;
        continue;
      }
      const next = render();
      if (sameText(body, next)) continue;
      if (CHECK_ONLY) {
        report.stale.push(`public/brands/${t.id}/${name}`);
        continue;
      }
      writeFileSync(path, next);
      report.wrote.push(`public/brands/${t.id}/${name}`);
      continue;
    }
    if (CHECK_ONLY) {
      report.stale.push(`public/brands/${t.id}/${name} (missing)`);
      continue;
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, render());
    report.wrote.push(`public/brands/${t.id}/${name}`);
  }
  return custom;
}

function renderModule(tenants, defaultSlug) {
  const hostIndex = {};
  for (const t of tenants) {
    for (const host of [t.domains.marketing, t.domains.app]) {
      if (host && !hostIndex[host]) hostIndex[host] = t.slug;
    }
  }
  const aliasIndex = {};
  for (const t of tenants) {
    for (const alias of t.aliases) {
      if (alias !== t.slug) aliasIndex[alias] = t.slug;
    }
  }
  const body = tenants
    .map((t) => {
      const theme = t.theme;
      const domains = [
        t.domains.marketing ? `marketing: ${JSON.stringify(t.domains.marketing)}` : null,
        t.domains.app ? `app: ${JSON.stringify(t.domains.app)}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `  ${JSON.stringify(t.slug)}: {
    id: ${JSON.stringify(t.id)},
    slug: ${JSON.stringify(t.slug)},
    aliases: ${JSON.stringify(t.aliases)},
    displayName: ${JSON.stringify(t.displayName)},
    legalName: ${JSON.stringify(t.legalName)},
    tagline: ${JSON.stringify(t.tagline)},
    initials: ${JSON.stringify(t.initials)},
    licenseTier: ${JSON.stringify(t.licenseTier)},
    hasCustomLogo: ${t.hasCustomLogo},
    theme: {
      mode: ${JSON.stringify(theme.mode)},
      primary: ${JSON.stringify(theme.primary)},
      accent: ${JSON.stringify(theme.accent)},
      background: ${JSON.stringify(theme.background)},
      foreground: ${JSON.stringify(theme.foreground)},
      logoPath: ${JSON.stringify(theme.logoPath)},
      markPath: ${JSON.stringify(theme.markPath)},
      faviconPath: ${JSON.stringify(theme.faviconPath)},
    },
    domains: { ${domains} },
  },`;
    })
    .join("\n");

  return `// AUTO-GENERATED by scripts/brand-sync.mjs — DO NOT EDIT BY HAND.
// Source of truth: config/platform/tenants/*.json
// Regenerate with: npm run brand:sync
//
// This module is intentionally free of node:fs and React imports so the Edge
// middleware and client components can share one brand map with the server.

export type BrandMode = "dark" | "light";

export type BrandTheme = {
  readonly mode: BrandMode;
  readonly primary: string;
  readonly accent: string;
  readonly background: string;
  readonly foreground: string;
  readonly logoPath: string;
  readonly markPath: string;
  readonly faviconPath: string;
};

export type TenantBrand = {
  readonly id: string;
  readonly slug: string;
  readonly aliases: readonly string[];
  readonly displayName: string;
  readonly legalName: string;
  readonly tagline: string;
  readonly initials: string;
  readonly licenseTier: string;
  readonly hasCustomLogo: boolean;
  readonly theme: BrandTheme;
  readonly domains: { readonly marketing?: string; readonly app?: string };
};

export const TENANTS: Record<string, TenantBrand> = {
${body}
};

/** alias -> canonical slug */
export const TENANT_ALIASES: Record<string, string> = ${JSON.stringify(aliasIndex, null, 2)};

/** hostname (no port, lowercase) -> canonical slug */
export const TENANT_HOSTS: Record<string, string> = ${JSON.stringify(hostIndex, null, 2)};

/** Platform-tier tenant — the brand used when nothing else resolves. */
export const DEFAULT_TENANT_SLUG = ${JSON.stringify(defaultSlug)};

export const TENANT_SLUGS: readonly string[] = Object.keys(TENANTS);
`;
}

/** Empty leftover dirs (e.g. a deleted dry-run tenant) must not linger as a fake brand. Never delete a dir that still has files — that could be a client's logo sitting without JSON. */
function pruneOrphanBrandDirs(tenantIds, report) {
  if (!existsSync(BRANDS_DIR)) return;
  const known = new Set(tenantIds);
  for (const name of readdirSync(BRANDS_DIR)) {
    if (name.startsWith(".")) continue;
    if (known.has(name)) continue;
    const dir = join(BRANDS_DIR, name);
    let kids = [];
    try {
      kids = readdirSync(dir);
    } catch {
      continue;
    }
    if (kids.length > 0) {
      console.warn(
        `brand-sync: leftover public/brands/${name} has files but no tenant JSON — not deleting (logo permanence).`,
      );
      continue;
    }
    if (CHECK_ONLY) {
      report.stale.push(`public/brands/${name} (orphan empty dir)`);
      continue;
    }
    rmSync(dir, { recursive: true });
    report.wrote.push(`public/brands/${name}/ (orphan empty dir removed)`);
  }
}

function main() {
  const tenants = loadTenants();
  const report = { wrote: [], stale: [] };
  pruneOrphanBrandDirs(tenants.map((t) => t.id), report);
  for (const t of tenants) t.hasCustomLogo = syncBrandAssets(t, report);
  const platform = tenants.find((t) => t.licenseTier === "platform");
  const defaultSlug = (platform ?? tenants[0]).slug;
  const next = renderModule(tenants, defaultSlug);
  const current = existsSync(OUT_TS) ? readFileSync(OUT_TS, "utf8") : null;
  if (!sameText(current, next)) {
    if (CHECK_ONLY) report.stale.push("src/lib/platform/tenant-map.generated.ts");
    else {
      mkdirSync(dirname(OUT_TS), { recursive: true });
      writeFileSync(OUT_TS, next);
      report.wrote.push("src/lib/platform/tenant-map.generated.ts");
    }
  }
  if (CHECK_ONLY) {
    if (report.stale.length > 0) {
      console.error("brand-sync: OUT OF DATE. Run `npm run brand:sync`.");
      for (const f of report.stale) console.error(`  - ${f}`);
      process.exit(1);
    }
    console.log(`brand-sync: up to date (${tenants.length} tenants).`);
    return;
  }
  console.log(`brand-sync: ${tenants.length} tenants -> ${defaultSlug} is default`);
  for (const t of tenants) {
    console.log(`  - ${t.slug.padEnd(16)} ${t.displayName} (${t.hasCustomLogo ? "custom logo" : "placeholder logo"})`);
  }
  if (report.wrote.length > 0) {
    console.log(`brand-sync: wrote ${report.wrote.length} file(s):`);
    for (const f of report.wrote) console.log(`  + ${f}`);
  } else {
    console.log("brand-sync: everything already current.");
  }
}

try {
  main();
} catch (err) {
  console.error(`brand-sync failed: ${err.message}`);
  process.exit(1);
}
