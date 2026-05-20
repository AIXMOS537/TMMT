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
import { hasOrgModule, type OrgLicense } from "./org-license";

export type RentalsNavItem = { href: string; label: string; icon: LucideIcon };
export type RentalsNavGroup = { label: string; items: RentalsNavItem[] };

export function buildRentalsNavGroups(base: string, license: OrgLicense | null): RentalsNavGroup[] {
  if (license && !hasOrgModule(license, "rentals_app")) {
    return [
      {
        label: "Overview",
        items: [{ href: base, label: "Dashboard", icon: LayoutDashboard }],
      },
    ];
  }

  return [
    { label: "Overview", items: [{ href: base, label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "Interfaces",
      items: [
        { href: `${base}/interfaces/appointments`, label: "Appointments", icon: CalendarRange },
        { href: `${base}/interfaces/contracts`, label: "Contracts", icon: FileText },
        { href: `${base}/interfaces/vehicles`, label: "Vehicles", icon: Car },
        { href: `${base}/interfaces/payments`, label: "Payments", icon: DollarSign },
      ],
    },
    {
      label: "Pipeline",
      items: [
        { href: `${base}/leads`, label: "Incoming Leads", icon: UserPlus },
        { href: `${base}/background-checks`, label: "Background Checks", icon: ShieldCheck },
        { href: `${base}/waitlist`, label: "Waitlist", icon: Clock },
        { href: `${base}/appointments`, label: "Appointments", icon: CalendarCheck },
      ],
    },
    {
      label: "Customers",
      items: [
        { href: `${base}/customers`, label: "Active Customers", icon: Users },
        { href: `${base}/payments`, label: "Payments", icon: CreditCard },
        { href: `${base}/former-customers`, label: "Former Customers", icon: Users },
        { href: `${base}/do-not-rent`, label: "Do Not Rent", icon: Ban },
      ],
    },
    {
      label: "Fleet",
      items: [
        { href: `${base}/fleet`, label: "Fleet Vehicles", icon: Car },
        { href: `${base}/inspections`, label: "Car Inspections", icon: ClipboardCheck },
        { href: `${base}/maintenance`, label: "Maintenance", icon: Wrench },
        { href: `${base}/insurance`, label: "Insurance", icon: Shield },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: `${base}/tickets`, label: "Tickets", icon: AlertTriangle },
        { href: `${base}/expenses`, label: "Expenses", icon: DollarSign },
        { href: `${base}/contracts`, label: "Contracts", icon: FileText },
        { href: `${base}/vendors`, label: "Vendors / Shops", icon: Store },
        { href: `${base}/operation-costs`, label: "Software & Tools", icon: UserCog },
      ],
    },
  ];
}
