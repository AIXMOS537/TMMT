"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { commandHubSections, type CommandHubLink } from "@/lib/command-hub-nav";
import { COMMAND_HUB_HREF } from "@/lib/command-hub-access";

/**
 * The dispatch cockpit is a full-height map + queue, so the nav collapses to a
 * vertical dropdown there instead of eating a row of vertical space.
 */
const DROPDOWN_ROUTE = "/dispatch";

export default function CommandHubNav({ allowedHrefs }: { allowedHrefs: string[] }) {
  const pathname = usePathname();
  const allowed = new Set(allowedHrefs);
  const showHub = allowed.has(COMMAND_HUB_HREF);
  const sections = commandHubSections
    .map((section) => ({
      ...section,
      links: section.links.filter((link) => allowed.has(link.href)),
    }))
    .filter((section) => section.links.length > 0);

  if (!showHub && sections.length === 0) return null;

  const asDropdown =
    pathname === DROPDOWN_ROUTE || pathname.startsWith(`${DROPDOWN_ROUTE}/`);

  return (
    <nav
      aria-label="Command center"
      className="border-b border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/50"
    >
      {asDropdown ? (
        <DropdownNav sections={sections} showHub={showHub} pathname={pathname} />
      ) : (
        <BarNav sections={sections} showHub={showHub} pathname={pathname} />
      )}
    </nav>
  );
}

type Sections = { title: string; links: CommandHubLink[] }[];

function isActive(pathname: string, link: CommandHubLink) {
  return !link.external && (pathname === link.href || pathname.startsWith(`${link.href}/`));
}

/** Default: one scrollable row of pills. */
function BarNav({
  sections,
  showHub,
  pathname,
}: {
  sections: Sections;
  showHub: boolean;
  pathname: string;
}) {
  const pill = (active: boolean) =>
    cn(
      "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
      active
        ? "bg-blue-600 text-white"
        : "text-gray-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800"
    );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex gap-2 overflow-x-auto">
      {showHub && (
        <Link href={COMMAND_HUB_HREF} className={pill(pathname === COMMAND_HUB_HREF)}>
          Hub
        </Link>
      )}
      {sections
        .flatMap((section) => section.links)
        .map((item) =>
          item.external ? (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={pill(false)}
            >
              {item.label}
            </a>
          ) : (
            <Link key={item.href} href={item.href} className={pill(isActive(pathname, item))}>
              {item.label}
            </Link>
          )
        )}
    </div>
  );
}

/** Dispatch only: a single trigger that opens the sections stacked vertically. */
function DropdownNav({
  sections,
  showHub,
  pathname,
}: {
  sections: Sections;
  showHub: boolean;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const current =
    pathname === COMMAND_HUB_HREF
      ? "Hub"
      : sections.flatMap((s) => s.links).find((l) => isActive(pathname, l))?.label ?? "Menu";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const item = (active: boolean) =>
    cn(
      "flex items-start gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
      active
        ? "bg-blue-600 text-white"
        : "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
    );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
      <div ref={containerRef} className="relative inline-block text-left">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="max-w-[16rem] truncate">{current}</span>
          <ChevronDown
            size={16}
            className={cn("shrink-0 transition-transform", open && "rotate-180")}
          />
        </button>

        {open && (
          <div
            id={menuId}
            role="menu"
            aria-label="Command center sections"
            className="absolute left-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-lg"
          >
            {showHub && (
              <Link
                href={COMMAND_HUB_HREF}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={item(pathname === COMMAND_HUB_HREF)}
              >
                <LayoutDashboard size={16} className="mt-0.5 shrink-0" />
                <span className="font-medium">Hub</span>
              </Link>
            )}

            {sections.map((section) => (
              <div key={section.title} className="mt-2 first:mt-0">
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                  {section.title}
                </p>
                {section.links.map((link) => {
                  const active = isActive(pathname, link);
                  const Icon = link.icon;
                  const body = (
                    <>
                      <Icon size={16} className="mt-0.5 shrink-0" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{link.label}</span>
                          {link.badge && (
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                active
                                  ? "bg-white/20 text-white"
                                  : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
                              )}
                            >
                              {link.badge}
                            </span>
                          )}
                        </span>
                        <span
                          className={cn(
                            "block text-xs",
                            active ? "text-blue-100" : "text-gray-500 dark:text-slate-400"
                          )}
                        >
                          {link.description}
                        </span>
                      </span>
                    </>
                  );

                  if (link.external) {
                    return (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className={item(false)}
                      >
                        {body}
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className={item(active)}
                    >
                      {body}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
