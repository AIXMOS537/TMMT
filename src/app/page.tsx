import Link from "next/link";
import { Car, ArrowRight } from "lucide-react";
import CommandCenterShell from "@/components/CommandCenterShell";
import { getActiveVentures } from "@/lib/ventures";
import { ventureHref } from "@/lib/venture-paths";

export default async function PortfolioPage() {
  let ventures: Awaited<ReturnType<typeof getActiveVentures>> = [];
  let loadError = false;

  try {
    ventures = await getActiveVentures();
  } catch {
    loadError = true;
  }

  return (
    <CommandCenterShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Portfolio</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Ventures in your command center
          </p>
        </div>

        {loadError && (
          <p className="text-amber-700 dark:text-amber-400 text-sm rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
            Could not load ventures. Apply migration{" "}
            <code className="text-xs">20260517120000_command_center_ventures.sql</code> in Supabase,
            or open{" "}
            <Link href="/v/tmmt-rentals" className="underline">
              TMMT Rentals
            </Link>{" "}
            directly.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(ventures.length > 0
            ? ventures
            : [
                {
                  slug: "tmmt-rentals",
                  name: "TMMT Rentals",
                  description: "Vehicle rental operations",
                  color: "#2563eb",
                  status: "active" as const,
                },
              ]
          ).map((v) => (
            <Link
              key={v.slug}
              href={ventureHref(v.slug, "/")}
              className="group rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${v.color ?? "#2563eb"}22` }}
                  >
                    <Car size={20} style={{ color: v.color ?? "#2563eb" }} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white">{v.name}</h2>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{v.slug}</p>
                  </div>
                </div>
                <ArrowRight
                  size={18}
                  className="text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0"
                />
              </div>
              {v.description && (
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-3 line-clamp-2">
                  {v.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </CommandCenterShell>
  );
}
