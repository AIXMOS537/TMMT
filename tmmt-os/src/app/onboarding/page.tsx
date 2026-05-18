import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveOnboardingProfile } from "./actions";

const ROLE_NEXT: Record<string, { href: string; label: string }> = {
  admin: { href: "/portals", label: "Choose portal" },
  internal_team: { href: "/portals", label: "Choose portal" },
  vendor: { href: "/portals", label: "Choose portal" },
  investor: { href: "/client/dashboard", label: "Client portal" },
  customer: { href: "/client/dashboard", label: "Client portal" },
};

export default async function OnboardingPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?next=/onboarding");

  const complete = Boolean(me.full_name?.trim());
  const next = ROLE_NEXT[me.role] ?? ROLE_NEXT.customer;

  return (
    <main className="min-h-screen container py-16 max-w-lg space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Welcome to TMMT OS</p>
        <h1 className="text-3xl font-semibold">User onboarding</h1>
        <p className="text-muted-foreground text-sm">
          Signed in as {me.email} · role <span className="font-medium">{me.role}</span>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
          <CardDescription>Used across cases, bookings, and notifications.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveOnboardingProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={me.full_name ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" placeholder="+1 …" />
            </div>
            <Button type="submit" className="w-full">
              Save and continue
            </Button>
          </form>
        </CardContent>
      </Card>

      {complete && (
        <Card>
          <CardHeader>
            <CardTitle>Next step</CardTitle>
            <CardDescription>Your portal is ready based on your role.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link href={next.href}>
              <Button className="w-full">{next.label}</Button>
            </Link>
            <Link href="/learn">
              <Button variant="outline" className="w-full">
                Browse Learn
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
