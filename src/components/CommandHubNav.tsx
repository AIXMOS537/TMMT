"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { commandHubSections } from "@/lib/command-hub-nav";

const quickLinks = commandHubSections.flatMap((s) => s.links);

export default function CommandHubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Command center"
      className="border-b border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/50"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex gap-2 overflow-x-auto">
        <Link
          href="/command"
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            pathname === "/command"
              ? "bg-blue-600 text-white"
              : "text-gray-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800"
          )}
        >
          Hub
        </Link>
        {quickLinks.map((item) => {
          const active =
            !item.external &&
            (pathname === item.href || pathname.startsWith(`${item.href}/`));
          const className = cn(
            "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
            active
              ? "bg-blue-600 text-white"
              : "text-gray-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800"
          );
          if (item.external) {
            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {item.label}
              </a>
            );
          }
          return (
            <Link key={item.href} href={item.href} className={className}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
