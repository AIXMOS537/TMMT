"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { revokeResponderLink } from "../actions";

export type ResponderLinkRow = {
  id: string;
  org_id: string;
  user_id: string;
  link_kind: "vendor"|"operator"|"client_volunteer"|"contractor";
  approved_at: string | null;
  active: boolean;
  certs: Record<string, unknown>;
  profiles: { full_name: string | null; email: string | null; telegram_chat_id: string | null } | null;
};

export function RespondersClient({ links }: { orgId: string; links: ResponderLinkRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ul className="mt-6 divide-y dark:divide-zinc-800">
      {links.map(l => (
        <li key={l.id} className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium">{l.profiles?.full_name ?? l.profiles?.email ?? l.user_id.slice(0,8)}</p>
            <p className="text-xs text-zinc-500">
              {l.link_kind} · {l.active ? "active" : "revoked"}
              {l.profiles?.telegram_chat_id ? " · TG ✓" : " · TG ✗"}
            </p>
          </div>
          {l.active && (
            <button
              disabled={pending}
              onClick={() => start(async () => {
                const r = await revokeResponderLink(l.id);
                if (r.ok) router.refresh();
              })}
              className="rounded bg-rose-100 px-3 py-1 text-sm text-rose-700 hover:bg-rose-200"
            >
              revoke
            </button>
          )}
        </li>
      ))}
      {links.length === 0 && (
        <li className="py-3 text-sm text-zinc-500">No responder links yet. Add users to the org_responder_links table to begin.</li>
      )}
    </ul>
  );
}
