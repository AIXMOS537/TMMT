"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function JourneyEmailLookup() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    router.push(`/internal/journey/${encodeURIComponent(normalized)}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="renter@email.com"
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Open journey
      </button>
    </form>
  );
}
