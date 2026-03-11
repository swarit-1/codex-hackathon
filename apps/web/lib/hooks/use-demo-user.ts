"use client";

import { createContext, useContext, type ReactNode } from "react";
import React from "react";

interface DemoUserState {
  userId: string | null;
  isBootstrapping: boolean;
}

const DemoUserContext = createContext<DemoUserState>({
  userId: null,
  isBootstrapping: false,
});

export function useDemoUser(): DemoUserState {
  return useContext(DemoUserContext);
}

/**
 * Provides demo user context.
 *
 * In mock mode (no Convex URL), userId is null and hooks use mock data directly.
 * When Convex is configured, this provider should call:
 *   const bootstrap = useMutation(api.demo.bootstrapWorkspace);
 *   // then store the returned userId in state
 */
export function DemoUserProvider({ children }: { children: ReactNode }) {
  return React.createElement(
    DemoUserContext.Provider,
    { value: { userId: null, isBootstrapping: false } },
    children
  );
}
