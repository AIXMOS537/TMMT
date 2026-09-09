import type { BusinessLineId } from "@/lib/business-lines/types";

export type TailorBrand = {
  /** Platform name shown in app title, login, and metadata (e.g. TMMT OS). */
  name: string;
  /** Management / command-center brand — staff ops and back office (e.g. TMMT Management). */
  managementBrand?: string;
  productName?: string;
  commandCenterLabel?: string;
  themeColor?: string;
  primaryPublicLineId?: BusinessLineId;
};

export type TailorHome = {
  eyebrow?: string;
  headline?: string;
  primaryCta?: string;
  otherBusinessesTitle?: string;
  otherBusinessesDescription?: string;
  staffNote?: string;
};

export type TailorPortalCard = {
  title: string;
  description: string;
  href: string;
};

export type TailorBusinessLineOverride = {
  name?: string;
  shortName?: string;
  tagline?: string;
  description?: string;
  intake?: {
    title?: string;
    description?: string;
    subjectPlaceholder?: string;
    detailsPlaceholder?: string;
    accent?: string;
  };
};

export type TailorConfig = {
  brand: TailorBrand;
  home?: TailorHome;
  businessLines?: {
    enabled?: BusinessLineId[] | null;
    disabled?: BusinessLineId[];
    overrides?: Partial<Record<BusinessLineId, TailorBusinessLineOverride>>;
  };
  portals?: TailorPortalCard[];
  features?: {
    showOtherBusinesses?: boolean;
    showPortalsSection?: boolean;
    maxFeaturedBusinessLines?: number;
  };
};
