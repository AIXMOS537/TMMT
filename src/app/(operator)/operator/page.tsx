"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getOpsMessages } from "@/lib/queries";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { CheckCircle, GraduationCap, ArrowRight, Users } from "lucide-react";

export default function OperatorFeedPage() {
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOpsMessages({ audience: "operators", status: "published" })
      .then(setMessages)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operator instructions"
        description="Only AI-reviewed, published messages appear here"
      />

      <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-lg w-fit">
        <CheckCircle size={14} />
        Fact-checked against company requirements
      </div>

      <Link href="/operator/training">
        <Card className="p-4 flex items-center gap-3 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <GraduationCap size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white">
              Operator Academy
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Work through your modules, get certified, unlock your full toolkit.
            </p>
          </div>
          <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />
        </Card>
      </Link>

      <Link href="/operator/leads">
        <Card className="p-4 flex items-center gap-3 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <Users size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white">Leads</p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Claim available leads for your agency and work the ones that are yours.
            </p>
          </div>
          <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />
        </Card>
      </Link>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full" />
        </div>
      ) : messages.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-500">
          No instructions yet. Your executive VA will publish updates when ready.
        </Card>
      ) : (
        <ul className="space-y-4">
          {messages.map((m) => (
            <li key={String(m.id)}>
              <Card className="p-5">
                <div className="flex justify-between items-center mb-3">
                  <StatusBadge status="Published" />
                  <span className="text-xs text-gray-400">
                    {formatDateTime((m.published_at || m.created_at) as string)}
                  </span>
                </div>
                <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {m.body as string}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
