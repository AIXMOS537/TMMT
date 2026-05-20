import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Car,
  UserPlus,
  ShieldCheck,
  Clock,
  CalendarCheck,
  CalendarRange,
  Users,
  CreditCard,
  Shield,
  AlertTriangle,
  Wrench,
  FileText,
  DollarSign,
  Store,
  UserCog,
  Ban,
  ClipboardCheck,
} from "lucide-react";
import { hasOrgModuleAccess } from "./org-license";
import type { OrgModule } from "./org-license";
import type { ResolvedAccess } from "./types";

export type RentalsNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type RentalsNavGroup = {
  label: string;
  items: RentalsNavItem[];
  module?: OrgModule;
};

export function buildRentalsNavGroups(
  base: string,
  access: ResolvedAccess | null
): RentalsNavGroup[] {
  const all: RentalsNavGroup[] = [
    {
      label: "Overview",
      module: "rentals_app",
      items: [{ href: base, label: "Dashboard", icon: LayoutDashboard }],
    },
    {
      label: "Interfaces",
      module: "rentals_app",
      items: [
        { href: `${base}/interfaces/appointments`, label: "Appointments", icon: CalendarRange },
        { href: `${base}/interfaces/contracts`, label: "Contracts", icon: FileText },
        { href: `${base}/interfaces/vehicles`, label: "Vehicles", icon: Car },
        { href: `${base}/interfaces/payments`, label: "Payments", icon: DollarSign },
      ],
    },
    {
      label: "Pipeline",
      module: "rentals_app",
      items: [
        { href: `${base}/leads`, label: "Incoming Leads", icon: UserPlus },
        { href: `${base}/background-checks`, label: "Background Checks", icon: ShieldCheck },
        { href: `${base}/waitlist`, label: "Waitlist", icon: Clock },
        { href: `${base}/appointments`, label: "Appointments", icon: CalendarCheck },
      ],
    },
    {
      label: "Customers",
      module: "rentals_app",
      items: [
        { href: `${base}/customers`, label: "Active Customers", icon: Users },
        { href: `${base}/payments`, label: "Payments", icon: CreditCard },
        { href: `${base}/former-customers`, label: "Former Customers", icon: Users },
        { href: `${base}/do-not-rent`, label: "Do Not Rent", icon: Ban },
      ],
    },
    {
      label: "Fleet",
      module: "rentals_app",
      items: [
        { href: `${base}/fleet`, label: "Fleet Vehicles", icon: Car },
        { href: `${base}/inspections`, label: "Car Inspections", icon: ClipboardCheck },
        { href: `${base}/maintenance`, label: "Maintenance", icon: Wrench },
        { href: `${base}/insurance`, label: "Insurance", icon: Shield },
      ],
    },
    {
      label: "Operations",
      module: "rentals_app",
      items: [
        { href: `${base}/tickets`, label: "Tickets", icon: AlertTriangle },
        { href: `${base}/expenses`, label: "Expenses", icon: DollarSign },
        { href: `${base}/contracts`, label: "Contracts", icon: FileText },
        { href: `${base}/vendors`, label: "Vendors / Shops", icon: Store },
        { href: `${base}/operation-costs`, label: "Software & Tools", icon: UserCog },
      ],
    },
  ];

  if (!access) return all;

  return all.filter((group) => {
    if (!group.module) return true;
    return hasOrgModuleAccess(access, group.module);
  });
}
