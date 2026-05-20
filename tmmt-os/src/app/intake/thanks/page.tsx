import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ThanksPage({ searchParams }: { searchParams: { ref?: string } }) {
  return (
    <main className="min-h-screen container py-12 max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Request received</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Thanks — we got your request. Check status online anytime instead of calling for
            updates.
          </p>
          {searchParams.ref && (
            <p className="text-sm">
              Your reference number:{" "}
              <span className="font-mono font-medium text-foreground">{searchParams.ref}</span>
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {searchParams.ref && (
              <Link href={`/track?ref=${encodeURIComponent(searchParams.ref)}`}>
                <Button className="w-full sm:w-auto">Track status</Button>
              </Link>
            )}
            <Link href="/login">
              <Button variant="outline" className="w-full sm:w-auto">
                Sign in for full portal
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground pt-2">
            <Link href="/" className="underline">
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
