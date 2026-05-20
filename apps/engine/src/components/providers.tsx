"use client";

import { CubeProvider } from "@aixmos/core";
import { EngineChrome } from "@/components/engine-chrome";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CubeProvider defaultRole="client">
      <EngineChrome>{children}</EngineChrome>
    </CubeProvider>
  );
}
