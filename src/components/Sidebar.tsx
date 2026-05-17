"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
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
  ChevronDown,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { signOut } from "@/app/(admin)/actions";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Interfaces",
    items: [
      { href: "/interfaces/appointments", label: "Appointments", icon: CalendarRange },
      { href: "/interfaces/contracts", label: "Contracts", icon: FileText },
      { href: "/interfaces/vehicles", label: "Vehicles", icon: Car },
      { href: "/interfaces/payments", label: "Payments", icon: DollarSign },
    ],
  },
  {
    label: "Workflow",
    items: [
      { href: "/cases", label: "Cases", icon: ClipboardCheck },
      { href: "/workflow-vendors", label: "Outside Vendors", icon: Store },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/leads", label: "Incoming Leads", icon: UserPlus },
      { href: "/background-checks", label: "Background Checks", icon: ShieldCheck },
      { href: "/waitlist", label: "Waitlist", icon: Clock },
      { href: "/appointments", label: "Appointments", icon: CalendarCheck },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/customers", label: "Active Customers", icon: Users },
      { href: "/payments", label: "Payments", icon: CreditCard },
      { href: "/former-customers", label: "Former Customers", icon: Users },
      { href: "/do-not-rent", label: "Do Not Rent", icon: Ban },
    ],
  },
  {
    label: "Fleet",
    items: [
      { href: "/fleet", label: "Fleet Vehicles", icon: Car },
      { href: "/inspections", label: "Car Inspections", icon: ClipboardCheck },
      { href: "/maintenance", label: "Maintenance", icon: Wrench },
      { href: "/insurance", label: "Insurance", icon: Shield },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/tickets", label: "Tickets", icon: AlertTriangle },
      { href: "/expenses", label: "Expenses", icon: DollarSign },
      { href: "/contracts", label: "Contracts", icon: FileText },
      { href: "/vendors", label: "Vendors / Shops", icon: Store },
      { href: "/operation-costs", label: "Software & Tools", icon: UserCog },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden bg-white dark:bg-slate-800 rounded-lg p-2 shadow-md"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close navigation" : "Open navigation"}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 dark:bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label="Main navigation"
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 overflow-y-auto transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-5 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <Car className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">TMMT Rentals</span>
          </Link>
          <ThemeToggle />
        </div>

        <nav className="p-3 space-y-1">
          {navGroups.map((group) => (
            <div key={group.label}>
              <button
                onClick={() => toggle(group.label)}
                aria-expanded={!collapsed[group.label]}
                className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider hover:text-gray-600 dark:hover:text-slate-300"
              >
                {group.label}
                <ChevronDown
                  size={14}
                  className={cn(
                    "transition-transform",
                    collapsed[group.label] && "-rotate-90"
                  )}
                />
              </button>

              {!collapsed[group.label] && (
                <div className="space-y-0.5 mb-2">
                  {group.items.map((item) => {
                    const isActive =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                            : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200"
                        )}
                      >
                        <item.icon size={18} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-slate-700 mt-auto">
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200 transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
