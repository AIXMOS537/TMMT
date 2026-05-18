"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type ViewTab = { key: string; label: string; icon?: ReactNode };

export function ViewSwitcher({ tabs, param = "view", defaultTab }: { tabs: ViewTab[]; param?: string; defaultTab?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = searchParams.get(param) ?? defaultTab ?? tabs[0]?.key;

  function setView(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(param, key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="mb-6 inline-flex w-full max-w-full gap-1 overflow-x-auto rounded-xl border border-border/70 bg-muted/50 p-1 scrollbar-thin sm:w-auto">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => setView(tab.key)}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
            active === tab.key
              ? "bg-card text-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function useActiveView(defaultTab: string, param = "view") {
  const searchParams = useSearchParams();
  return searchParams.get(param) ?? defaultTab;
}
