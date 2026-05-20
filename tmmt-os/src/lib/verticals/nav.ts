import type { InternalNavLink, OrgVertical } from "./types";
import { brandingForVertical } from "./branding";

const PROPERTY_NAV: InternalNavLink[] = [
  { href: "/internal/property", label: "Dashboard" },
  { href: "/internal/property/setup", label: "Setup wizard" },
  { href: "/internal/marketplace", label: "Marketplace" },
  { href: "/internal/briefing", label: "COO briefing" },
  { href: "/internal/partner-verticals", label: "Partner apps" },
  { href: "/internal/sync", label: "CRM sync" },
  { href: "/internal/ghl-sync", label: "GHL live" },
];

const SERVICE_ARBITRAGE_NAV: InternalNavLink[] = [
  { href: "/internal/property", label: "Dashboard" },
  { href: "/internal/property/setup", label: "Setup wizard" },
  { href: "/internal/marketplace", label: "Marketplace" },
  { href: "/internal/operators", label: "Operators" },
  { href: "/internal/briefing", label: "COO briefing" },
  { href: "/internal/partner-verticals", label: "Partner apps" },
];

const DEALER_NAV: InternalNavLink[] = [
  { href: "/internal/dealer", label: "Dashboard" },
  { href: "/internal/dealer/onboarding", label: "Setup wizard" },
  { href: "/internal/dealer/inventory", label: "Inventory" },
  { href: "/internal/dealer/leads", label: "Leads" },
  { href: "/internal/dealer/deals", label: "Deal desk" },
  { href: "/internal/dealer/collections", label: "Collections" },
  { href: "/internal/dealer/service", label: "Service" },
  { href: "/internal/dealer/payments", label: "Payments" },
  { href: "/internal/billing", label: "Billing" },
];

function rentalNav(isAdmin: boolean): InternalNavLink[] {
  return [
    { href: "/internal/dashboard", label: "Dashboard" },
    { href: "/internal/dealer", label: "LotOS (dealer)" },
    { href: "/internal/assistant", label: "Command" },
    { href: "/internal/cases", label: "Cases" },
    { href: "/internal/journey", label: "Journey" },
    { href: "/internal/operators", label: "Operators" },
    { href: "/internal/marketplace", label: "Marketplace" },
    { href: "/internal/briefing", label: "COO briefing" },
    { href: "/internal/partner-verticals", label: "Partner apps" },
    { href: "/v/tmmt-rentals", label: "Rentals admin" },
    { href: "/internal/sync", label: "CRM sync" },
    { href: "/internal/ghl-sync", label: "GHL live" },
    { href: "/internal/ledger", label: "Finance" },
    { href: "/internal/vendors", label: "Vendors" },
    { href: "/internal/billing", label: "Billing" },
    ...(isAdmin ? [{ href: "/internal/agency", label: "Agency" }] : []),
    ...(isAdmin ? [{ href: "/internal/admin", label: "Admin" }] : []),
  ];
}

export function getInternalNavLinks(vertical: OrgVertical, isAdmin: boolean): InternalNavLink[] {
  if (vertical === "dealer") return DEALER_NAV;
  if (vertical === "property") return PROPERTY_NAV;
  if (vertical === "service_arbitrage") return SERVICE_ARBITRAGE_NAV;
  return rentalNav(isAdmin);
}

export function getDealerBrand(vertical: OrgVertical): string {
  return brandingForVertical(vertical).opsBrand;
}
