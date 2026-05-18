import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen container py-16 space-y-12">
      <header>
        <h1 className="text-4xl font-semibold">TMMT OS</h1>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Three portals · one login</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Client Portal</CardTitle>
              <CardDescription>Apps, training, documents, billing — by package.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/client/dashboard"><Button variant="outline" className="w-full">Enter</Button></Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Team Portal</CardTitle>
              <CardDescription>SOPs, scripts, workflows, and internal training.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/team/dashboard"><Button variant="outline" className="w-full">Enter</Button></Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Admin Dashboard</CardTitle>
              <CardDescription>Users, packages, revenue, and access overrides.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/dashboard"><Button variant="outline" className="w-full">Enter</Button></Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Learn</CardTitle>
            <CardDescription>Operator training and ecosystem guides.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/learn"><Button variant="outline" className="w-full">Browse</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Marketplace</CardTitle>
            <CardDescription>Rentals catalog and fleet availability.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/marketplace"><Button variant="outline" className="w-full">Browse</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Onboarding</CardTitle>
            <CardDescription>Complete your profile after sign-in.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/onboarding"><Button variant="outline" className="w-full">Start</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Submit a request</CardTitle>
            <CardDescription>Anyone can start a case here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/intake"><Button className="w-full">New intake form</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Internal team</CardTitle>
            <CardDescription>Cases, tasks, vendor assignment.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/internal/dashboard"><Button variant="outline" className="w-full">Open</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vendor portal</CardTitle>
            <CardDescription>Approved vendors: your job queue.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/vendor/dashboard"><Button variant="outline" className="w-full">Open</Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Investor portal</CardTitle>
            <CardDescription>Performance updates & reports.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/investor/dashboard"><Button variant="outline" className="w-full">Open</Button></Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
