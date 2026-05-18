"use client";

import { Menu, X } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { PortalSidebar } from "./portal-sidebar";
import type { PortalId } from "@/lib/access/types";
import { cn } from "@/lib/utils";

export function OpsMobileShell({
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
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <header className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b border-border/80 bg-card/95 px-4 backdrop-blur-md md:hidden">
        <button
          type="button"
          aria-label={navOpen ? "Close menu" : "Open menu"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-background"
          onClick={() => setNavOpen((o) => !o)}
        >
          {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{brand}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {user?.full_name || user?.email || "Operations"}
          </p>
        </div>
      </header>

      {navOpen && (
        <button
          type="button"
          aria-label="Close menu overlay"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(18rem,88vw)] transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:transition-none",
          navOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <PortalSidebar
          brand={brand}
          operationLinks={links}
          user={user}
          portals={portals}
          currentPortal={currentPortal}
          onNavigate={() => setNavOpen(false)}
          className="h-full min-h-screen md:min-h-0"
        />
      </div>

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
