import Link from "next/link";
import { Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  variant?: "client" | "public";
};

export function ContactFirstBanner({ variant = "client" }: Props) {
  return (
    <div className="surface-card border-l-4 border-l-primary p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium">Get updates here — before you call</p>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">
            {variant === "client"
              ? "Your rental status, tickets, and team messages update on this portal. Open a ticket or check Updates instead of waiting on the phone."
              : "Track your request with your reference number and email. Sign in for full rental and ticket history."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {variant === "client" ? (
          <>
            <Link href="/client/updates">
              <Button size="sm">View updates</Button>
            </Link>
            <Link href="/client/support">
              <Button size="sm" variant="outline">
                Message the team
              </Button>
            </Link>
          </>
        ) : (
          <>
            <Link href="/track">
              <Button size="sm">Track a request</Button>
            </Link>
            <Link href="/login">
              <Button size="sm" variant="outline">
                Sign in
              </Button>
            </Link>
          </>
        )}
        {process.env.NEXT_PUBLIC_URGENT_PHONE ? (
          <a href={`tel:${process.env.NEXT_PUBLIC_URGENT_PHONE}`} className="hidden sm:inline-flex">
            <Button size="sm" variant="ghost" className="text-muted-foreground">
              <Phone className="h-4 w-4 mr-1" />
              Urgent only
            </Button>
          </a>
        ) : null}
      </div>
    </div>
  );
}
