"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createContext, useContext, type ReactNode, useMemo } from "react";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

const ConvexModeContext = createContext<boolean>(false);

/** Returns true when Convex is connected and ready. */
export function useConvexMode(): boolean {
  return useContext(ConvexModeContext);
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    if (!CONVEX_URL) return null;
    return new ConvexReactClient(CONVEX_URL);
  }, []);

  if (!client) {
    return (
      <ConvexModeContext.Provider value={false}>
        {children}
      </ConvexModeContext.Provider>
    );
  }

  return (
    <ConvexProvider client={client}>
      <ConvexModeContext.Provider value={true}>
        {children}
      </ConvexModeContext.Provider>
    </ConvexProvider>
  );
}
