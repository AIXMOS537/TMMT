"use client";

import { useBrand } from "./BrandProvider";

export type BrandNameProps = {
  className?: string;
  variant?: "display" | "legal";
};

export function BrandName({ className, variant = "display" }: BrandNameProps) {
  const brand = useBrand();
  return (
    <span className={className}>
      {variant === "legal" ? brand.legalName : brand.displayName}
    </span>
  );
}

export default BrandName;
