"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CubeProvider } from "@aixmos/core";

function CubeProviderInner({
  children,
  defaultRole = "client",
}: {
  children: React.ReactNode;
  defaultRole?: "client" | "coach" | "admin" | "supervisor";
}) {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId");

  return (
    <CubeProvider defaultRole={defaultRole} applicationId={applicationId}>
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
