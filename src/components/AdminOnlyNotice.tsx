"use client";

import { Lock } from "lucide-react";
import { PageHeader } from "@/components/ui";

/**
 * Shown where a page's underlying table is restricted to platform admins.
 * Without this a staff member just sees an empty table and assumes it is broken.
 */
export default function AdminOnlyNotice({
  title,
  what,
}: {
  title: string;
  what: string;
}) {
  return (
    <div>
      <PageHeader title={title} description="Restricted" />
      <div className="mx-auto mt-6 max-w-xl rounded-lg border border-gray-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400">
          <Lock size={18} />
        </div>
        <h2 className="mb-1 text-base font-semibold text-gray-900 dark:text-white">
          Admins only
        </h2>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          {what} is limited to account admins. Nothing is wrong with your login — ask Taha if
          you need access.
        </p>
      </div>
    </div>
  );
}
