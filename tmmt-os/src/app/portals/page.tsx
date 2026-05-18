import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserAccess } from "@/lib/access/resolve";
import { defaultPortalHref, portalHomeHref, portalLabel } from "@/lib/access/portals";
import type { PortalId } from "@/lib/access/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PORTAL_ACCENT: Record<PortalId, string> = {
  client: "border-l-violet-500 border-t-violet-500 bg-violet-50/40",
  team: "border-l-teal-500 border-t-teal-500 bg-teal-50/40",
  admin: "border-l-amber-500 border-t-amber-500 bg-amber-50/40",
  ops: "border-l-blue-500 border-t-blue-500 bg-blue-50/40",
};

export const dynamic = "force-dynamic";

export default async function PortalsHubPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const access = await getUserAccess();
  if (!access) redirect("/login");

  if (access.portals.length === 1) {
    redirect(defaultPortalHref(access.profile));
  }

  return (
    <main className="min-h-screen container py-16 max-w-lg space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Choose your portal</h1>
        <p className="text-muted-foreground text-sm">
          Signed in as {access.profile.email}. Pick the workspace that matches what you&apos;re doing.
        </p>
        {searchParams.error === "forbidden" && (
          <p className="text-sm text-destructive">You don&apos;t have access to that portal.</p>
        )}
        {searchParams.error === "entitlement" && (
          <p className="text-sm text-destructive">That module isn&apos;t on your plan.</p>
        )}
      </header>

      <div className="space-y-3">
        {access.portals.map((p: PortalId) => (
          <Card
            key={p}
            className={cn("border-l-4 border-t-4 transition-colors hover:shadow-sm", PORTAL_ACCENT[p])}
          >
            <CardHeader>
              <CardTitle>{portalLabel(p)}</CardTitle>
              <CardDescription>{portalHomeHref(p)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={portalHomeHref(p)}>
                <Button className="w-full">Enter</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        Back to home
      </Link>
    </main>
  );
}
