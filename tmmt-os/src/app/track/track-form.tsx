"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { lookupCaseAction } from "./actions";
import Link from "next/link";

export function TrackRequestForm() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<Awaited<ReturnType<typeof lookupCaseAction>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState(searchParams.get("ref") ?? "");

  useEffect(() => {
    const q = searchParams.get("ref");
    if (q) setRef(q);
  }, [searchParams]);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setResult(null);
    try {
      const res = await lookupCaseAction(formData);
      setResult(res);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Look up status</CardTitle>
          <CardDescription>Reference number + email must match your submission.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ref_code">Reference number</Label>
              <Input
                id="ref_code"
                name="ref_code"
                required
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="C-XXXXXXXX"
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="you@email.com" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Looking up…" : "Check status"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card
          className={
            result.found ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-amber-500"
          }
        >
          <CardHeader>
            <CardTitle className="text-lg">{result.found ? result.subject : "Not found"}</CardTitle>
            {result.found && (
              <CardDescription className="font-mono text-xs">{result.ref_code}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {result.found ? (
              <>
                <p className="text-lg font-semibold">{result.status_label}</p>
                <p className="text-muted-foreground leading-relaxed">{result.status_message}</p>
                <p className="text-xs text-muted-foreground">
                  Last updated {new Date(result.updated_at).toLocaleString()}
                </p>
                <p className="pt-2 text-muted-foreground">
                  For full history and to message the team without calling,{" "}
                  <Link href="/login" className="text-primary underline">
                    sign in to the portal
                  </Link>
                  .
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">{result.message}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
