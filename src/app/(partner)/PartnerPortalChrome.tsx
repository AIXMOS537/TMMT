"use client";

import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui";
import { signOut } from "@/app/(admin)/actions";
import { LogOut } from "lucide-react";

export default function PartnerPortalChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-slate-700 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              Partner portal
            </p>
            <p className="font-semibold text-gray-900 dark:text-white">
              TMMT Rentals
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Investor &amp; partner view · vehicle program status
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <form action={signOut}>
              <Button type="submit" variant="secondary" className="gap-2">
                <LogOut size={16} />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
