"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; the text is still selectable */
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="flex-1 truncate rounded-lg bg-gray-100 dark:bg-slate-700 px-3 py-2 text-xs text-gray-800 dark:text-slate-200">
        {link}
      </code>
      <button
        onClick={copy}
        className="rounded-lg bg-blue-600 hover:bg-blue-700 p-2 text-white"
        aria-label="Copy link"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
