import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { TENANTS, TENANT_ALIASES, TENANT_HOSTS, DEFAULT_TENANT_SLUG } from "./tenant-map.generated";

const REPO_ROOT = process.cwd();
const TENANT_DIR = join(REPO_ROOT, "config", "platform", "tenants");

function tenantFiles() {
  return readdirSync(TENANT_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
}

function readTenant(file: string) {
  return JSON.parse(readFileSync(join(TENANT_DIR, file), "utf8"));
}

describe("tenant-map.generated", () => {
  it("covers every tenant config, and nothing else", () => {
    const fromDisk = tenantFiles().map((f) => readTenant(f).slug).sort();
    expect(Object.keys(TENANTS).sort()).toEqual(fromDisk);
  });

  it("matches the authored brand facts (run `npm run brand:sync` if this fails)", () => {
    for (const file of tenantFiles()) {
      const raw = readTenant(file);
      const generated = TENANTS[raw.slug];
      expect(generated, `${file}: slug ${raw.slug} missing from generated map`).toBeDefined();
      expect(generated.id).toBe(raw.id);
      expect(generated.displayName).toBe(raw.displayName);
      expect(generated.legalName).toBe(raw.legalName || raw.displayName);
      expect(generated.tagline).toBe(raw.tagline ?? "");
      expect(generated.theme.primary).toBe(raw.theme.primary);
      expect(generated.theme.accent).toBe(raw.theme.accent);
      expect(generated.theme.logoPath).toBe(raw.theme.logoPath);
    }
  });

  it("resolves every alias to exactly one tenant", () => {
    for (const [alias, slug] of Object.entries(TENANT_ALIASES)) {
      expect(TENANTS[slug], `alias ${alias} points at unknown tenant ${slug}`).toBeDefined();
    }
    for (const alias of Object.keys(TENANT_ALIASES)) {
      expect(Object.keys(TENANTS)).not.toContain(alias);
    }
  });

  it("points every host at a known tenant", () => {
    for (const [host, slug] of Object.entries(TENANT_HOSTS)) {
      expect(TENANTS[slug], `host ${host} points at unknown tenant ${slug}`).toBeDefined();
      expect(host).toBe(host.toLowerCase());
      expect(host).not.toMatch(/:\d+$/);
    }
  });

  it("has a resolvable default tenant", () => {
    expect(TENANTS[DEFAULT_TENANT_SLUG]).toBeDefined();
  });

  it("ships the artwork every brand advertises", () => {
    for (const brand of Object.values(TENANTS)) {
      for (const path of [brand.theme.logoPath, brand.theme.markPath, brand.theme.faviconPath]) {
        expect(
          existsSync(join(REPO_ROOT, "public", path.replace(/^\//, ""))),
          `${brand.slug}: ${path} does not exist in public/`,
        ).toBe(true);
      }
    }
  });
});
