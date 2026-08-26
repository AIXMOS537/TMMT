/**
 * Turns a tenant theme into CSS custom properties.
 * Pure functions only — no fs, no React, no dependencies.
 */
import type { CSSProperties } from "react";
import type { BrandTheme } from "./tenant-map.generated";

type Rgb = { r: number; g: number; b: number };

const SAFE = {
  primary: "#7fffd4",
  accent: "#6366f1",
  background: "#0a0a0a",
  foreground: "#ffffff",
} as const;

export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const chan = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
}

export function contrastOn(hex: string): "#000000" | "#ffffff" {
  return luminance(hex) > 0.45 ? "#000000" : "#ffffff";
}

export function mix(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  if (!a || !b) return from;
  const t = Math.max(0, Math.min(1, amount));
  return toHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

function safeTheme(theme: Pick<BrandTheme, "primary" | "accent" | "background" | "foreground">) {
  return {
    primary: parseHex(theme?.primary) ? theme.primary : SAFE.primary,
    accent: parseHex(theme?.accent) ? theme.accent : SAFE.accent,
    background: parseHex(theme?.background) ? theme.background : SAFE.background,
    foreground: parseHex(theme?.foreground) ? theme.foreground : SAFE.foreground,
  };
}

export type BrandTokenName =
  | "--brand-primary"
  | "--brand-primary-ink"
  | "--brand-primary-soft"
  | "--brand-accent"
  | "--brand-accent-ink"
  | "--brand-bg"
  | "--brand-fg"
  | "--brand-surface"
  | "--brand-surface-2"
  | "--brand-border"
  | "--brand-muted-fg"
  | "--brand-ring";

export function brandTokens(
  theme: Pick<BrandTheme, "primary" | "accent" | "background" | "foreground">,
): Record<BrandTokenName, string> {
  const t = safeTheme(theme);
  return {
    "--brand-primary": t.primary,
    "--brand-primary-ink": contrastOn(t.primary),
    "--brand-primary-soft": mix(t.background, t.primary, 0.18),
    "--brand-accent": t.accent,
    "--brand-accent-ink": contrastOn(t.accent),
    "--brand-bg": t.background,
    "--brand-fg": t.foreground,
    "--brand-surface": mix(t.background, t.foreground, 0.06),
    "--brand-surface-2": mix(t.background, t.foreground, 0.12),
    "--brand-border": mix(t.background, t.foreground, 0.18),
    "--brand-muted-fg": mix(t.foreground, t.background, 0.35),
    "--brand-ring": t.primary,
  };
}

export function brandStyle(
  theme: Pick<BrandTheme, "primary" | "accent" | "background" | "foreground">,
): CSSProperties {
  return brandTokens(theme) as CSSProperties;
}

export function brandCssText(
  theme: Pick<BrandTheme, "primary" | "accent" | "background" | "foreground">,
  selector = ":root",
): string {
  const body = Object.entries(brandTokens(theme))
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `${selector} {\n${body}\n}`;
}
