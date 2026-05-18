"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalSwitcher } from "./portal-switcher";
import type { PortalId } from "@/lib/access/types";
import { rentalsInterfaceHref } from "@/lib/rentals-portal";

import type { ReactNode } from "react";

type NavLink = { href: string; label: string; icon: ReactNode; external?: boolean };

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
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
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={link.href} className={className}>
      {inner}
    </Link>
  );
}

function NavGroup({ label, links, pathname }: { label: string; links: NavLink[]; pathname: string }) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
        {label}
      </p>
      {links.map((link) => {
        const active = !link.external && (pathname === link.href || pathname.startsWith(`${link.href}/`));
        return <NavItem key={link.href} link={link} active={active} />;
      })}
    </div>
  );
}

export function PortalSidebar({
  brand,
  opsLinks,
  user,
  portals,
  currentPortal,
}: {
  brand: string;
  opsLinks: { href: string; label: string }[];
  user?: { full_name?: string | null; email?: string | null; role?: string | null } | null;
  portals?: PortalId[];
  currentPortal?: PortalId;
}) {
  const pathname = usePathname();

  const ops: NavLink[] = opsLinks.map((l) => ({
    ...l,
    icon:
      l.href.includes("dashboard") ? (
        <LayoutDashboard className="h-4 w-4 shrink-0" />
      ) : l.href.includes("cases") ? (
        <FolderKanban className="h-4 w-4 shrink-0" />
      ) : l.href.includes("sync") ? (
        <RefreshCw className="h-4 w-4 shrink-0" />
      ) : l.href.includes("vendors") ? (
        <Users className="h-4 w-4 shrink-0" />
      ) : l.href.includes("interfaces") ? (
        <LayoutGrid className="h-4 w-4 shrink-0" />
      ) : l.href.includes("admin") ? (
        <Settings className="h-4 w-4 shrink-0" />
      ) : (
        <LayoutDashboard className="h-4 w-4 shrink-0" />
      ),
    external: l.href.startsWith("http"),
  }));

  const interfaces: NavLink[] = [
    {
      href: "/internal/interfaces",
      label: "All interfaces",
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
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          {brand}
        </Link>
        {portals && currentPortal && (
          <div className="mt-3">
            <PortalSwitcher portals={portals} current={currentPortal} />
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-4 scrollbar-thin">
        <NavGroup label="Operations" links={ops} pathname={pathname} />
        <NavGroup label="Airtable interfaces" links={interfaces} pathname={pathname} />
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
