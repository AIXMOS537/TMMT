"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ventureHref } from "@/lib/venture-paths";
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
  LayoutGrid,
  FileCode,
  Settings,
} from "lucide-react";
import { useMemo, useState } from "react";
import { signOut } from "@/app/auth-actions";

type SidebarProps = {
  ventureSlug: string;
  ventureName: string;
  ventureColor?: string | null;
};

function buildNavGroups(base: string) {
  return [
    {
      label: "Overview",
      items: [{ href: base, label: "Dashboard", icon: LayoutDashboard }],
    },
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

const commandCenterItems = [
  { href: "/", label: "Portfolio", icon: LayoutGrid },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/scripts", label: "Scripts", icon: FileCode },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ ventureSlug, ventureName, ventureColor }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const base = ventureHref(ventureSlug, "/");
  const navGroups = useMemo(() => buildNavGroups(base), [base]);

  const toggle = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));

  const accent = ventureColor ?? "#2563eb";

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 lg:hidden bg-white dark:bg-slate-800 rounded-lg p-2 shadow-md"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close navigation" : "Open navigation"}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 dark:bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        aria-label="Main navigation"
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 overflow-y-auto transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div
          className="p-5 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between"
          style={{ borderLeftWidth: 4, borderLeftColor: accent }}
        >
          <Link href={base} className="flex items-center gap-2 min-w-0" onClick={() => setOpen(false)}>
            <Car className="h-7 w-7 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-bold text-gray-900 dark:text-white truncate">{ventureName}</span>
          </Link>
          <ThemeToggle />
        </div>

        <nav className="p-3 space-y-1">
          <div className="mb-2">
            <button
              onClick={() => toggle("Command Center")}
              aria-expanded={!collapsed["Command Center"]}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider hover:text-gray-600 dark:hover:text-slate-300"
            >
              Command Center
              <ChevronDown
                size={14}
                className={cn("transition-transform", collapsed["Command Center"] && "-rotate-90")}
              />
            </button>
            {!collapsed["Command Center"] && (
              <div className="space-y-0.5 mb-2">
                {commandCenterItems.map((item) => {
                  const isActive =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                          : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
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
                  className={cn("transition-transform", collapsed[group.label] && "-rotate-90")}
                />
              </button>

              {!collapsed[group.label] && (
                <div className="space-y-0.5 mb-2">
                  {group.items.map((item) => {
                    const isActive =
                      item.href === base
                        ? pathname === base
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
