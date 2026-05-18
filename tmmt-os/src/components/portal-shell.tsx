import Link from "next/link";
import { ReactNode } from "react";
import { PortalSwitcher } from "./portal-switcher";
import { OpsMobileShell } from "./ops-mobile-shell";
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
  /** Ops-style layout with left nav (drawer on phone) */
  sidebar?: boolean;
}) {
  if (sidebar) {
    return (
      <OpsMobileShell
        brand={brand}
        links={links}
        user={user}
        portals={portals}
        currentPortal={currentPortal}
      >
        {children}
      </OpsMobileShell>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/90 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
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
          <div className="flex items-center gap-2 text-sm sm:gap-3">
            {portals && currentPortal && (
              <PortalSwitcher portals={portals} current={currentPortal} />
            )}
            <span className="hidden max-w-[10rem] truncate text-muted-foreground sm:inline md:max-w-[12rem]">
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
      <main className={cn("container flex-1 px-4 py-6 sm:px-6 lg:py-10")}>{children}</main>
    </div>
  );
}
