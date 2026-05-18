"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  RefreshCw,
  Users,
  Settings,
  LayoutGrid,
  CalendarRange,
  FileText,
  Car,
  DollarSign,
  ExternalLink,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalSwitcher } from "./portal-switcher";
import type { PortalId } from "@/lib/access/types";
import { rentalsInterfaceHref } from "@/lib/rentals-portal";

type NavLink = { href: string; label: string; icon: ReactNode; external?: boolean };

function NavItem({
  link,
  active,
  onNavigate,
}: {
  link: NavLink;
  active: boolean;
  onNavigate?: () => void;
}) {
  const className = cn("nav-pill w-full", active && "nav-pill-active");
  const inner = (
    <>
      {link.icon}
      <span className="truncate">{link.label}</span>
      {link.external && <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-50" />}
    </>
  );

  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onNavigate}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={link.href} className={className} onClick={onNavigate}>
      {inner}
    </Link>
  );
}

function NavGroup({
  label,
  links,
  pathname,
  onNavigate,
}: {
  label: string;
  links: NavLink[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
        {label}
      </p>
      {links.map((link) => {
        const active =
          !link.external && (pathname === link.href || pathname.startsWith(`${link.href}/`));
        return <NavItem key={link.href} link={link} active={active} onNavigate={onNavigate} />;
      })}
    </div>
  );
}

const OPERATION_ICONS: Record<string, ReactNode> = {
  dashboard: <LayoutDashboard className="h-4 w-4 shrink-0" />,
  cases: <FolderKanban className="h-4 w-4 shrink-0" />,
  sync: <RefreshCw className="h-4 w-4 shrink-0" />,
  ledger: <Wallet className="h-4 w-4 shrink-0" />,
  vendors: <Users className="h-4 w-4 shrink-0" />,
  admin: <Settings className="h-4 w-4 shrink-0" />,
};

function iconForOpsHref(href: string): ReactNode {
  if (href.includes("dashboard")) return OPERATION_ICONS.dashboard;
  if (href.includes("cases")) return OPERATION_ICONS.cases;
  if (href.includes("sync")) return OPERATION_ICONS.sync;
  if (href.includes("ledger")) return OPERATION_ICONS.ledger;
  if (href.includes("vendors")) return OPERATION_ICONS.vendors;
  if (href.includes("admin")) return OPERATION_ICONS.admin;
  return OPERATION_ICONS.dashboard;
}

export function PortalSidebar({
  brand = "TMMT OS",
  operationLinks,
  user,
  portals,
  currentPortal,
  onNavigate,
  className,
}: {
  brand?: string;
  operationLinks: { href: string; label: string }[];
  user?: { full_name?: string | null; email?: string | null; role?: string | null } | null;
  portals?: PortalId[];
  currentPortal?: PortalId;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  const operations: NavLink[] = operationLinks.map((l) => ({
    ...l,
    icon: iconForOpsHref(l.href),
    external: l.href.startsWith("http"),
  }));

  const management: NavLink[] = [
    {
      href: "/internal/interfaces",
      label: "Overview",
      icon: <LayoutGrid className="h-4 w-4 shrink-0" />,
    },
    {
      href: rentalsInterfaceHref("appointments"),
      label: "Appointments",
      icon: <CalendarRange className="h-4 w-4 shrink-0" />,
      external: true,
    },
    {
      href: rentalsInterfaceHref("contracts"),
      label: "Contracts",
      icon: <FileText className="h-4 w-4 shrink-0" />,
      external: true,
    },
    {
      href: rentalsInterfaceHref("vehicles"),
      label: "Vehicles",
      icon: <Car className="h-4 w-4 shrink-0" />,
      external: true,
    },
    {
      href: rentalsInterfaceHref("payments"),
      label: "Payments",
      icon: <DollarSign className="h-4 w-4 shrink-0" />,
      external: true,
    },
  ];

  return (
    <aside
      className={cn(
        "flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
        className
      )}
    >
      <div className="border-b border-sidebar-border px-4 py-4">
        <Link
          href="/internal/dashboard"
          className="text-sm font-semibold tracking-tight text-sidebar-foreground"
          onClick={onNavigate}
        >
          {brand}
        </Link>
        <p className="mt-0.5 text-[10px] text-sidebar-muted">Operations workspace</p>
        {portals && currentPortal && (
          <div className="mt-3">
            <PortalSwitcher portals={portals} current={currentPortal} />
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-4 scrollbar-thin">
        <NavGroup label="Operations" links={operations} pathname={pathname} onNavigate={onNavigate} />
        <NavGroup label="TMMT Management" links={management} pathname={pathname} onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <p className="truncate text-xs font-medium text-sidebar-foreground">
          {user?.full_name || user?.email}
        </p>
        {user?.role && <p className="text-[10px] capitalize text-sidebar-muted">{user.role}</p>}
        <form action="/auth/signout" method="post" className="mt-3">
          <button
            type="submit"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
