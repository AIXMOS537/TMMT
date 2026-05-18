import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PortalSection } from "@/lib/access/sections";
import type { ResolvedAccess } from "@/lib/access/types";
import { hasEntitlement } from "@/lib/access/resolve";

export function PortalSectionGrid({
  sections,
  access,
  packageLabel,
}: {
  sections: PortalSection[];
  access: ResolvedAccess;
  packageLabel?: string | null;
}) {
  return (
    <div className="space-y-6">
      {packageLabel && (
        <p className="text-sm text-muted-foreground">
          Package: <span className="font-medium capitalize">{packageLabel}</span>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const allowed = hasEntitlement(access, section.entitlement);
          return (
            <Card key={section.slug} className={allowed ? "" : "opacity-60"}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  {!allowed && <Badge variant="outline">Locked</Badge>}
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {allowed ? (
                  <Link href={section.href} className="text-sm font-medium hover:underline">
                    Open →
                  </Link>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Not included in your plan. Upgrade or ask admin for access.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
