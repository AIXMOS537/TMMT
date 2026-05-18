"use client";

import { useParams } from "next/navigation";

export function useVentureSlug(): string {
  const params = useParams();
  const venture = params?.venture;
  return typeof venture === "string" ? venture : "tmmt-rentals";
}
