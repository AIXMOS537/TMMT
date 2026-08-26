/**
 * Renders a tenant's logo, and can never render a broken image.
 * Placeholder tenants get an inline monogram; custom artwork is served as a file.
 */
import { contrastOn } from "@/lib/platform/brand-tokens";
import type { TenantBrand } from "@/lib/platform/tenant-resolve";

export type BrandLogoProps = {
  brand: TenantBrand;
  variant?: "full" | "mark" | "wordmark";
  size?: number;
  className?: string;
};

export function BrandLogo({
  brand,
  variant = "full",
  size = 32,
  className,
}: BrandLogoProps) {
  const { theme, displayName } = brand;

  if (variant === "wordmark") {
    return (
      <span
        className={className}
        style={{
          fontSize: size * 0.56,
          fontWeight: 600,
          letterSpacing: 0.3,
          color: "var(--brand-fg, currentColor)",
          lineHeight: 1,
        }}
      >
        {displayName}
      </span>
    );
  }

  const mark = brand.hasCustomLogo ? (
    // eslint-disable-next-line @next/next/no-img-element -- tenant SVG of unknown size
    <img
      src={variant === "mark" ? theme.markPath : theme.logoPath}
      alt={displayName}
      height={size}
      style={{ height: size, width: "auto", display: "block" }}
    />
  ) : (
    <MonogramMark brand={brand} size={size} />
  );

  if (variant === "mark" || brand.hasCustomLogo) {
    return (
      <span className={className} style={{ display: "inline-flex", alignItems: "center" }}>
        {mark}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.34 }}
    >
      {mark}
      <span
        style={{
          fontSize: size * 0.5,
          fontWeight: 600,
          letterSpacing: 0.3,
          color: "var(--brand-fg, currentColor)",
          lineHeight: 1,
        }}
      >
        {displayName}
      </span>
    </span>
  );
}

function MonogramMark({ brand, size }: { brand: TenantBrand; size: number }) {
  const gradientId = `brand-mark-${brand.slug}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={brand.displayName}
      style={{ display: "block", flex: "none" }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={brand.theme.primary} />
          <stop offset="100%" stopColor={brand.theme.accent} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <text
        x="32"
        y="33"
        fill={contrastOn(brand.theme.primary)}
        fontFamily="system-ui,-apple-system,Segoe UI,sans-serif"
        fontSize="26"
        fontWeight="700"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {brand.initials}
      </text>
    </svg>
  );
}

export default BrandLogo;
