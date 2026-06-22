import Link from "next/link";
import { GraduationCap, Clock, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui";
import { ACADEMY_LESSONS } from "@/lib/academy";

export const metadata = { title: "Operator Academy · AIXMOS Pocket" };

export default function AcademyPage() {
  return (
    <div>
      <header className="mb-5">
        <Link href="/pocket" className="text-sm text-blue-600 dark:text-blue-400">← Pocket</Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <GraduationCap className="h-6 w-6" /> Operator Academy
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Learn how the network earns. Short lessons, real skills.
        </p>
      </header>

      <div className="space-y-3">
        {ACADEMY_LESSONS.map((l) => (
          <Link key={l.slug} href={`/pocket/academy/${l.slug}`} className="block">
            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">{l.title}</h2>
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                    <Clock className="h-3.5 w-3.5" /> {l.minutes} min
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
