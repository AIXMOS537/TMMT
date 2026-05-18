import Link from "next/link";
import type { PortalId } from "@/lib/access/types";
import { portalHomeHref, portalLabel } from "@/lib/access/portals";

export function PortalSwitcher({
  portals,
  current,
}: {
  portals: PortalId[];
  current: PortalId;
}) {
  if (portals.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-1 text-xs">
      {portals.map((p) => (
        <Link
          key={p}
          href={portalHomeHref(p)}
          className={
            p === current
              ? "rounded px-2 py-1 bg-background font-medium shadow-sm"
              : "rounded px-2 py-1 text-muted-foreground hover:text-foreground"
          }
        >
          {portalLabel(p)}
        </Link>
      ))}
    </div>
  );
}
