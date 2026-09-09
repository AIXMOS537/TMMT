import raw from "../../../config/tailor.json";
import type { TailorConfig } from "./types";

/** Loaded at build time from `config/tailor.json` — edit that file to tailor the app. */
export const TAILOR_CONFIG = raw as TailorConfig;

export function getTailorBrand() {
  return TAILOR_CONFIG.brand;
}

export function getTailorHome() {
  return TAILOR_CONFIG.home ?? {};
}

export function getTailorFeatures() {
  return {
    showOtherBusinesses: TAILOR_CONFIG.features?.showOtherBusinesses ?? true,
    showPortalsSection: TAILOR_CONFIG.features?.showPortalsSection ?? true,
    maxFeaturedBusinessLines: TAILOR_CONFIG.features?.maxFeaturedBusinessLines ?? 6,
  };
}

export function getTailorPortals(): TailorConfig["portals"] {
  return TAILOR_CONFIG.portals;
}

export function getBrandName(): string {
  return TAILOR_CONFIG.brand.name;
}

/** Staff / command-center brand (defaults to management line name). */
export function getManagementBrand(): string {
  return TAILOR_CONFIG.brand.managementBrand ?? "TMMT Management";
}

export function getCommandCenterLabel(): string {
  return (
    TAILOR_CONFIG.brand.commandCenterLabel ??
    `${getManagementBrand()} Command Center`
  );
}

/** Home page header: platform name + optional management subtitle. */
export function getHomeHeaderTitle(): string {
  return getBrandName();
}

export function getHomeHeaderSubtitle(): string | undefined {
  const mgmt = getManagementBrand();
  const os = getBrandName();
  if (mgmt && mgmt !== os) return mgmt;
  return undefined;
}
