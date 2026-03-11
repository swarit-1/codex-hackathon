"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createContext, useContext, type ReactNode, useMemo } from "react";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const FALLBACK_CONVEX_URL = "https://placeholder.convex.cloud";

const ConvexModeContext = createContext<boolean>(false);

/** Returns true when Convex is connected and ready. */
export function useConvexMode(): boolean {
  return useContext(ConvexModeContext);
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    return new ConvexReactClient(CONVEX_URL ?? FALLBACK_CONVEX_URL);
  }, []);

  return (
    <ConvexProvider client={client}>
      <ConvexModeContext.Provider value={Boolean(CONVEX_URL)}>
        {children}
      </ConvexModeContext.Provider>
    </ConvexProvider>
  );
}
