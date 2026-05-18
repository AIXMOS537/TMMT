import Link from "next/link";
import { ReactNode } from "react";
import { PortalSwitcher } from "./portal-switcher";
import { PortalSidebar } from "./portal-sidebar";
import type { PortalId } from "@/lib/access/types";
import { cn } from "@/lib/utils";

export function PortalShell({
  brand,
  links,
  user,
  children,
  portals,
  currentPortal,
  sidebar = false,
}: {
  brand: string;
  links: { href: string; label: string }[];
  user?: { full_name?: string | null; email?: string | null; role?: string | null } | null;
  children: ReactNode;
  portals?: PortalId[];
  currentPortal?: PortalId;
  /** Ops-style Airtable interface layout with left nav */
  sidebar?: boolean;
}) {
  if (sidebar) {
    return (
      <div className="flex min-h-screen">
        <PortalSidebar
          brand={brand}
          opsLinks={links}
          user={user}
          portals={portals}
          currentPortal={currentPortal}
        />
        <main className="min-w-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/90 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight">
              {brand}
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {links.map((l) =>
                l.href.startsWith("http") ? (
                  <a
                    key={l.href}
                    href={l.href}
                    className="nav-pill text-muted-foreground hover:text-foreground"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="nav-pill text-muted-foreground hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                )
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {portals && currentPortal && (
              <PortalSwitcher portals={portals} current={currentPortal} />
            )}
            <span className="hidden max-w-[12rem] truncate text-muted-foreground md:inline">
              {user?.full_name || user?.email}
              {user?.role ? ` · ${user.role}` : ""}
            </span>
            <form action="/auth/signout" method="post">
              <button
                className="rounded-lg px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className={cn("container flex-1 py-8 lg:py-10")}>{children}</main>
    </div>
  );
}
