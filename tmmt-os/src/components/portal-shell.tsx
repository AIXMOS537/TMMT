import Link from "next/link";
import { ReactNode } from "react";
import { PortalSwitcher } from "./portal-switcher";
import type { PortalId } from "@/lib/access/types";

export function PortalShell({
  brand,
  links,
  user,
  children,
  portals,
  currentPortal,
}: {
  brand: string;
  links: { href: string; label: string }[];
  user?: { full_name?: string | null; email?: string | null; role?: string | null } | null;
  children: ReactNode;
  portals?: PortalId[];
  currentPortal?: PortalId;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold">
              {brand}
            </Link>
            <nav className="flex gap-4 text-sm">
              {links.map((l) =>
                l.href.startsWith("http") ? (
                  <a
                    key={l.href}
                    href={l.href}
                    className="text-muted-foreground hover:text-foreground"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground">
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
            <span className="text-muted-foreground hidden sm:inline">
              {user?.full_name || user?.email} {user?.role ? `· ${user.role}` : ""}
            </span>
            <form action="/auth/signout" method="post">
              <button className="text-muted-foreground hover:text-foreground" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="container flex-1 py-8">{children}</main>
    </div>
  );
}
