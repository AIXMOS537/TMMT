import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Ported from TMMT OS. Two differences:
 *
 * - `searchParams` is awaited (Next 16).
 * - The "Track status" button is gone. It linked to /track, which exists in
 *   TMMT OS and does not exist here. Shipping a button to a 404 is worse than
 *   not shipping it; the reference number is still shown so the customer has
 *   it, and /track comes with the rest of intake in a later phase.
 */
export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl space-y-6 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Request received</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Thanks — we got your request. Someone will follow up on it.
          </p>
          {ref && (
            <p className="text-sm">
              Your reference number:{" "}
              <span className="font-mono font-medium text-foreground">{ref}</span> — keep it for
              any follow-up.
            </p>
          )}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link href="/login">
              <Button variant="outline" className="w-full sm:w-auto">
                Sign in for full portal
              </Button>
            </Link>
          </div>
          <p className="pt-2 text-sm text-muted-foreground">
            <Link href="/" className="underline">
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
