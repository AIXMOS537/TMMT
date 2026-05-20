export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded mt-2" />
        </div>
        <div className="h-9 w-28 bg-gray-200 dark:bg-slate-700 rounded-lg" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        <div className="h-10 w-72 bg-gray-200 dark:bg-slate-700 rounded-lg" />
        <div className="h-10 w-48 bg-gray-200 dark:bg-slate-700 rounded-lg" />
      </div>

      {/* Table skeleton */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 px-4 py-3 flex gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 bg-gray-200 dark:bg-slate-700 rounded flex-1" />
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="px-4 py-3 flex gap-4 border-b border-gray-100 dark:border-slate-700 last:border-0">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="h-4 bg-gray-100 dark:bg-slate-700/50 rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
