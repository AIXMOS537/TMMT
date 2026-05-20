"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

function friendlyAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid_credentials")) {
    return "Wrong email or password. For test accounts run: node scripts/set-test-passwords.mjs (sets TmmtPortalTest!2026).";
  }
  if (lower.includes("error sending magic link email")) {
    return "Email could not be sent. In Supabase → Authentication → SMTP, fix or disable custom SMTP (your server host must resolve in DNS). Use Password sign-in meanwhile.";
  }
  if (lower.includes("email link is invalid") || lower.includes("otp_expired")) {
    return "That sign-in link expired or was already used. Request a new magic link or use Password sign-in.";
  }
  return message;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const authMessage = params.get("message");
  const [error, setError] = useState<string | null>(() => {
    if (params.get("error") === "forbidden") return "You don't have access to that portal.";
    if (params.get("error") === "auth" && authMessage) return friendlyAuthError(authMessage);
    return null;
  });
  const [mode, setMode] = useState<"password" | "magic">("password");

  async function onPasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setError(friendlyAuthError(error.message));
    const next = params.get("next") || "/portals";
    router.replace(next);
    router.refresh();
  }

  async function onMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const next = params.get("next") || "/portals";
    const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) return setError(friendlyAuthError(error.message));
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Sign in to TMMT OS</h1>
          <p className="text-sm text-muted-foreground">
            Operations, portals, and Management workspaces. Rentals admin:{" "}
            <a
              href={process.env.NEXT_PUBLIC_PORTAL_URL ?? "https://tmmt-c919-two.vercel.app"}
              className="underline"
            >
              portal
            </a>
            .
          </p>
        </div>

        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`px-3 py-1 rounded ${mode === "password" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setMode("magic")}
            className={`px-3 py-1 rounded ${mode === "magic" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
          >
            Magic link
          </button>
        </div>

        {sent ? (
          <p className="text-sm">Check your email — we sent you a sign-in link.</p>
        ) : (
          <form onSubmit={mode === "password" ? onPasswordSignIn : onMagicLink} className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {mode === "password" && (
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full">
              {mode === "password" ? "Sign in" : "Send magic link"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
