import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PortalSection } from "@/lib/access/sections";
import type { ResolvedAccess } from "@/lib/access/types";
import { hasEntitlement } from "@/lib/access/resolve";
import { toneStyles, type StatusTone } from "@/lib/ui/status-colors";
import { cn } from "@/lib/utils";

const SECTION_TONE: Record<string, StatusTone> = {
  apps: "violet",
  documents: "blue",
  training: "teal",
  onboarding: "sky",
  rental: "violet",
  maintenance: "orange",
  support: "sky",
  billing: "amber",
  announcements: "blue",
  upgrade: "emerald",
  mission: "violet",
  sop: "slate",
  scripts: "sky",
  workflows: "teal",
  crm: "blue",
  cases: "orange",
  vendors: "teal",
  fleet: "emerald",
  revenue: "amber",
  users: "violet",
  packages: "blue",
  entitlements: "teal",
  audit: "slate",
  settings: "slate",
};

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
          const tone = SECTION_TONE[section.slug] ?? "slate";
          const s = toneStyles(tone);
          return (
            <Card
              key={section.slug}
              className={cn(
                "border-l-[3px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft",
                s.border,
                allowed ? s.row : "opacity-55 bg-muted/40"
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  {!allowed && <Badge variant="outline">Locked</Badge>}
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {allowed ? (
                  <Link href={section.href} className="text-sm font-medium text-primary hover:underline">
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
