"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { brandStyle } from "@/lib/platform/brand-tokens";
import { TENANTS, type TenantBrand } from "@/lib/platform/tenant-resolve";

const BrandContext = createContext<TenantBrand>(TENANTS.tmmt_property);

export function useBrand(): TenantBrand {
  return useContext(BrandContext);
}

export type BrandProviderProps = {
  brand: TenantBrand;
  children: ReactNode;
  paint?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function BrandProvider({
  brand,
  children,
  paint = false,
  className,
  style,
}: BrandProviderProps) {
  const painted: CSSProperties = paint
    ? { background: "var(--brand-bg)", color: "var(--brand-fg)" }
    : {};

  return (
    <BrandContext.Provider value={brand}>
      <div
        data-brand={brand.slug}
        data-brand-mode={brand.theme.mode}
        style={{ ...brandStyle(brand.theme), ...painted, ...style }}
        className={className}
      >
        {children}
      </div>
    </BrandContext.Provider>
  );
}

export default BrandProvider;
