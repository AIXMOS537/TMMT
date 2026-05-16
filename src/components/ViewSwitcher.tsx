"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type ViewTab = {
  key: string;
  label: string;
  icon?: React.ReactNode;
};

export function ViewSwitcher({ tabs, defaultTab }: { tabs: ViewTab[]; defaultTab?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeView = searchParams.get("view") ?? defaultTab ?? tabs[0]?.key;

  function setView(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 p-1 w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setView(tab.key)}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition",
            activeView === tab.key
              ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm"
              : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function useActiveView(defaultTab: string): string {
  const searchParams = useSearchParams();
  return searchParams.get("view") ?? defaultTab;
}
