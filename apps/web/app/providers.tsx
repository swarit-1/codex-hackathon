"use client";

import type { ReactNode } from "react";
import { ConvexClientProvider } from "../lib/convex/provider";
import { CurrentUserProvider } from "../lib/hooks/use-demo-user";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexClientProvider>
      <CurrentUserProvider>{children}</CurrentUserProvider>
    </ConvexClientProvider>
  );
}
