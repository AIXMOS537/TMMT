import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const CONFIG_ROOT = join(process.cwd(), "config", "platform");

const ThemeSchema = z.object({
  mode: z.enum(["dark", "light"]).default("dark"),
  primary: z.string(),
  accent: z.string(),
  background: z.string().default("#0a0a0a"),
  foreground: z.string().default("#ffffff"),
  logoPath: z.string().optional(),
  faviconPath: z.string().optional(),
});

export const BrandShellSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  displayName: z.string().min(1),
  legalName: z.string().optional(),
  tagline: z.string().default(""),
  locale: z
    .object({
      default: z.string().default("en-US"),
      currency: z.string().default("USD"),
      timezone: z.string().default("America/New_York"),
    })
    .default({ default: "en-US", currency: "USD", timezone: "America/New_York" }),
  region: z
    .object({
      primary: z.string().default("US"),
      compliancePack: z.string().default("us-general"),
    })
    .optional(),
  theme: ThemeSchema,
  domains: z
    .object({
      marketing: z.string().optional(),
      app: z.string().optional(),
    })
    .optional(),
  contact: z
    .object({
      supportEmail: z.string().optional(),
      salesPhone: z.string().optional(),
    })
    .optional(),
  agent: z
    .object({
      name: z.string().default("Riley"),
      persona: z.string().optional(),
    })
    .optional(),
  offers: z.object({ skus: z.array(z.string()).default([]) }).optional(),
  whiteLabel: z
    .object({
      licenseTier: z.string(),
      parentPlatformId: z.string(),
      customizable: z.array(z.string()).default([]),
    })
    .optional(),
});

export type BrandShell = z.infer<typeof BrandShellSchema>;

export type PlatformManifest = {
  platformId: string;
  platformName: string;
  platformTagline?: string;
  version: string;
  apexOwner: {
    name: string;
    title: string;
    publicNode?: string;
    entity?: string;
    workEmail?: string;
    doNotContact?: string;
  };
  global?: {
    defaultLocale?: string;
    supportedLocales?: string[];
    defaultCurrency?: string;
    defaultTimezone?: string;
  };
};

let _cache: Map<string, BrandShell> | null = null;

function loadAllShells(): Map<string, BrandShell> {
  if (_cache) return _cache;
  const dir = join(CONFIG_ROOT, "tenants");
  const map = new Map<string, BrandShell>();
  if (!existsSync(dir)) return map;

  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const shell = BrandShellSchema.parse(raw);
    map.set(shell.slug, shell);
    for (const alias of shell.aliases ?? []) {
      map.set(alias, shell);
    }
  }
  _cache = map;
  return map;
}

/** Resolve tenant brand by slug or alias (e.g. moe_legacy, tmmt). */
export function getBrandShell(slug: string): BrandShell | undefined {
  return loadAllShells().get(slug);
}

/** All canonical tenant shells (deduped by id). */
export function listBrandShells(): BrandShell[] {
  const seen = new Set<string>();
  const out: BrandShell[] = [];
  for (const shell of loadAllShells().values()) {
    if (seen.has(shell.id)) continue;
    seen.add(shell.id);
    out.push(shell);
  }
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Display-safe brand for landing pages — never throws. */
export function getBrandDisplay(slug: string): { name: string; tagline: string; theme: BrandShell["theme"] } {
  const shell = getBrandShell(slug);
  if (!shell) {
    return {
      name: "TMMT",
      tagline: "",
      theme: {
        mode: "dark",
        primary: "#7fffd4",
        accent: "#6366f1",
        background: "#0a0a0a",
        foreground: "#ffffff",
      },
    };
  }
  return { name: shell.displayName, tagline: shell.tagline, theme: shell.theme };
}

export function getPlatformManifest(): PlatformManifest {
  const path = join(CONFIG_ROOT, "manifest.json");
  if (!existsSync(path)) {
    return {
      platformId: "aixmos-platform",
      platformName: "AIXMOS Platform",
      version: "0.0.0",
      apexOwner: { name: "Muhammad Taha", title: "Founder & Apex Owner" },
    };
  }
  return JSON.parse(readFileSync(path, "utf8")) as PlatformManifest;
}

/** Clear cache (tests only). */
export function _resetBrandShellCache(): void {
  _cache = null;
}
