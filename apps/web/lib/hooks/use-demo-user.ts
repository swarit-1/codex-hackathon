"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CurrentUserProfile } from "../contracts/types";
import { useConvexMode } from "../convex/provider";

export const CURRENT_USER_STORAGE_KEY = "longhornet.currentUserId";

interface CurrentUserState {
  userId: string | null;
  profile: CurrentUserProfile | null;
  isLoading: boolean;
  needsOnboarding: boolean;
  setCurrentUser: (userId: string, profile?: CurrentUserProfile | null) => void;
  clearCurrentUser: () => void;
}

const CurrentUserContext = createContext<CurrentUserState>({
  userId: null,
  profile: null,
  isLoading: false,
  needsOnboarding: false,
  setCurrentUser: () => undefined,
  clearCurrentUser: () => undefined,
});

export function useCurrentUser(): CurrentUserState {
  return useContext(CurrentUserContext);
}

export function useDemoUser(): CurrentUserState {
  return useCurrentUser();
}

export function useRequireCurrentUser() {
  const router = useRouter();
  const pathname = usePathname();
  const convexEnabled = useConvexMode();
  const currentUser = useCurrentUser();

  const nextTarget = useMemo(() => {
    if (typeof window === "undefined") {
      return pathname;
    }

    const query = window.location.search;
    return `${window.location.pathname}${query}`;
  }, [pathname]);

  useEffect(() => {
    if (!convexEnabled || currentUser.isLoading || !currentUser.needsOnboarding) {
      return;
    }

    router.replace(`/onboarding?next=${encodeURIComponent(nextTarget)}`);
  }, [convexEnabled, currentUser.isLoading, currentUser.needsOnboarding, nextTarget, router]);

  return {
    ...currentUser,
    isReady:
      !convexEnabled ||
      (!currentUser.isLoading && !currentUser.needsOnboarding && Boolean(currentUser.userId)),
  };
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const convexEnabled = useConvexMode();
  const [hasHydratedStorage, setHasHydratedStorage] = useState(!convexEnabled);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileOverride, setProfileOverride] = useState<CurrentUserProfile | null>(null);

  useEffect(() => {
    if (!convexEnabled) {
      setHasHydratedStorage(true);
      return;
    }

    const storedUserId = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    setUserId(storedUserId);
    setHasHydratedStorage(true);
  }, [convexEnabled]);

  const profile = useQuery(
    api.users.getProfile,
    convexEnabled && userId
      ? {
          userId: userId as Id<"users">,
        }
      : "skip"
  );

  const clearCurrentUser = useCallback(() => {
    setUserId(null);
    setProfileOverride(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
  }, []);

  const setCurrentUser = useCallback(
    (nextUserId: string, nextProfile?: CurrentUserProfile | null) => {
      setUserId(nextUserId);
      setProfileOverride(nextProfile ?? null);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, nextUserId);
      }
    },
    []
  );

  useEffect(() => {
    if (!convexEnabled || !userId || profile !== null) {
      return;
    }

    clearCurrentUser();
  }, [clearCurrentUser, convexEnabled, profile, userId]);

  const currentProfile = profile === undefined ? profileOverride : profile ?? null;
  const isLoading =
    convexEnabled &&
    (!hasHydratedStorage || (Boolean(userId) && profile === undefined && currentProfile === null));

  const value = useMemo<CurrentUserState>(
    () => ({
      userId,
      profile: currentProfile,
      isLoading,
      needsOnboarding: convexEnabled && hasHydratedStorage && !userId,
      setCurrentUser,
      clearCurrentUser,
    }),
    [
      clearCurrentUser,
      convexEnabled,
      currentProfile,
      hasHydratedStorage,
      isLoading,
      setCurrentUser,
      userId,
    ]
  );

  return createElement(CurrentUserContext.Provider, { value }, children);
}

export function DemoUserProvider({ children }: { children: ReactNode }) {
  return createElement(CurrentUserProvider, null, children);
}
