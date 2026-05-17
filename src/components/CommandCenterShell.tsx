import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { Car, LayoutGrid } from "lucide-react";

export default function CommandCenterShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-gray-900 dark:text-white">AIX Command Center</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
              Portfolio
            </Link>
            <Link href="/teams" className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
              Teams
            </Link>
            <Link href="/scripts" className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
              Scripts
            </Link>
            <Link href="/settings" className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
              Settings
            </Link>
            <Link
              href="/v/tmmt-rentals"
              className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Car size={16} />
              TMMT Rentals
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
