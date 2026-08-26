import type { Metadata, Viewport } from "next";
import type { TenantBrand } from "./tenant-resolve";

export type BrandMetadataOptions = {
  title?: string;
  description?: string;
  index?: boolean;
};

export function brandMetadata(
  brand: TenantBrand,
  options: BrandMetadataOptions = {},
): Metadata {
  const title = options.title
    ? `${options.title} · ${brand.displayName}`
    : brand.displayName;
  const description = options.description || brand.tagline || undefined;
  return {
    title,
    description,
    applicationName: brand.displayName,
    icons: {
      icon: [{ url: brand.theme.faviconPath, type: "image/svg+xml" }],
    },
    openGraph: {
      title,
      description,
      siteName: brand.displayName,
    },
    robots: options.index ? undefined : { index: false, follow: false },
  };
}

export function brandViewport(brand: TenantBrand): Viewport {
  return { themeColor: brand.theme.background };
}
