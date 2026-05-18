import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PortalSectionPage({
  title,
  description,
  portalHome,
}: {
  title: string;
  description: string;
  portalHome: string;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Content coming soon</CardTitle>
          <CardDescription>
            This section is wired for entitlement access. Connect your LMS, document store, or
            ticketing system here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={portalHome}>
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
