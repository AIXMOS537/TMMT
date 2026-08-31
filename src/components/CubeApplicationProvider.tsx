"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CubeProvider } from "@aixmos/core";
import { findMyApplicationId } from "@/app/cube-application-actions";

function CubeProviderInner({
  children,
  defaultRole = "client",
}: {
  children: React.ReactNode;
  defaultRole?: "client" | "coach" | "admin" | "supervisor";
}) {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("applicationId");

  /**
   * Fall back to the signed-in user's own application.
   *
   * Without this the cube loaded an application only when one was named in the
   * URL, i.e. when someone followed a GHL deep link. Anyone who just signed in
   * and opened /learn was handed the demo persona "Jordan Rivera" out of
   * createInitialState() and their real application was never looked for.
   *
   * `resolving` matters: rendering CubeProvider with a null id even once seeds
   * mock state into localStorage, and that is the thing being fixed. So hold
   * until the lookup answers.
   */
  const [resolved, setResolved] = useState<string | null>(fromUrl);
  const [resolving, setResolving] = useState(!fromUrl);

  useEffect(() => {
    if (fromUrl) {
      setResolved(fromUrl);
      setResolving(false);
      return;
    }
    let cancelled = false;
    setResolving(true);
    findMyApplicationId()
      .then((id) => {
        if (!cancelled) setResolved(id);
      })
      .catch(() => {
        if (!cancelled) setResolved(null);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromUrl]);

  if (resolving) return null;

  return (
    <CubeProvider defaultRole={defaultRole} applicationId={resolved}>
      {children}
    </CubeProvider>
  );
}

export function CubeApplicationProvider({
  children,
  defaultRole = "client",
}: {
  children: React.ReactNode;
  defaultRole?: "client" | "coach" | "admin" | "supervisor";
}) {
  return (
    <Suspense fallback={null}>
      <CubeProviderInner defaultRole={defaultRole}>{children}</CubeProviderInner>
    </Suspense>
  );
}
