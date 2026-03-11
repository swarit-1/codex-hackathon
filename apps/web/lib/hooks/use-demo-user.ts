"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
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

export const CURRENT_SESSION_STORAGE_KEY = "longhornet.sessionToken";
const LEGACY_USER_STORAGE_KEY = "longhornet.currentUserId";

interface CurrentUserState {
  sessionToken: string | null;
  userId: string | null;
  profile: CurrentUserProfile | null;
  isLoading: boolean;
  needsAuthentication: boolean;
  needsOnboarding: boolean;
  setSession: (sessionToken: string, profile?: CurrentUserProfile | null) => void;
  clearSession: () => void;
}

const CurrentUserContext = createContext<CurrentUserState>({
  sessionToken: null,
  userId: null,
  profile: null,
  isLoading: false,
  needsAuthentication: false,
  needsOnboarding: false,
  setSession: () => undefined,
  clearSession: () => undefined,
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
    if (!convexEnabled || currentUser.isLoading || !currentUser.needsAuthentication) {
      return;
    }

    router.replace(`/login?next=${encodeURIComponent(nextTarget)}`);
  }, [convexEnabled, currentUser.isLoading, currentUser.needsAuthentication, nextTarget, router]);

  return {
    ...currentUser,
    isReady:
      !convexEnabled ||
      (!currentUser.isLoading &&
        !currentUser.needsAuthentication &&
        Boolean(currentUser.userId)),
  };
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const convexEnabled = useConvexMode();
  const [hasHydratedStorage, setHasHydratedStorage] = useState(!convexEnabled);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [profileOverride, setProfileOverride] = useState<CurrentUserProfile | null>(null);

  useEffect(() => {
    if (!convexEnabled) {
      setHasHydratedStorage(true);
      return;
    }

    const storedSessionToken = window.localStorage.getItem(CURRENT_SESSION_STORAGE_KEY);
    setSessionToken(storedSessionToken);
    window.localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
    setHasHydratedStorage(true);
  }, [convexEnabled]);

  const profile = useQuery(
    api.auth.getCurrentUser,
    convexEnabled && sessionToken
      ? {
          sessionToken,
        }
      : "skip"
  );

  const clearSession = useCallback(() => {
    setSessionToken(null);
    setProfileOverride(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CURRENT_SESSION_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
    }
  }, []);

  const setSession = useCallback(
    (nextSessionToken: string, nextProfile?: CurrentUserProfile | null) => {
      setSessionToken(nextSessionToken);
      setProfileOverride(nextProfile ?? null);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(CURRENT_SESSION_STORAGE_KEY, nextSessionToken);
        window.localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
      }
    },
    []
  );

  useEffect(() => {
    if (!convexEnabled || !sessionToken || profile !== null) {
      return;
    }

    clearSession();
  }, [clearSession, convexEnabled, profile, sessionToken]);

  const currentProfile = profile === undefined ? profileOverride : profile ?? null;
  const isLoading =
    convexEnabled &&
    (!hasHydratedStorage ||
      (Boolean(sessionToken) && profile === undefined && currentProfile === null));
  const needsAuthentication = convexEnabled && hasHydratedStorage && !sessionToken;

  const value = useMemo<CurrentUserState>(
    () => ({
      sessionToken,
      userId: currentProfile?.id ?? null,
      profile: currentProfile,
      isLoading,
      needsAuthentication,
      needsOnboarding: needsAuthentication,
      setSession,
      clearSession,
    }),
    [
      clearSession,
      currentProfile,
      isLoading,
      needsAuthentication,
      sessionToken,
      setSession,
    ]
  );

  return createElement(CurrentUserContext.Provider, { value }, children);
}

export function useAuthActions() {
  const convexEnabled = useConvexMode();
  const signInMutation = useMutation(api.auth.signIn);
  const signUpMutation = useMutation(api.auth.signUp);
  const signOutMutation = useMutation(api.auth.signOut);

  return {
    signIn: async (args: { email: string; password: string }) => {
      if (!convexEnabled) {
        return null;
      }

      return signInMutation(args);
    },
    signUp: async (args: {
      name: string;
      email: string;
      password: string;
      eid?: string;
      profileData?: Record<string, unknown>;
    }) => {
      if (!convexEnabled) {
        return null;
      }

      return signUpMutation(args);
    },
    signOut: async (sessionToken: string) => {
      if (!convexEnabled) {
        return null;
      }

      return signOutMutation({
        sessionToken,
      });
    },
  };
}

export function DemoUserProvider({ children }: { children: ReactNode }) {
  return createElement(CurrentUserProvider, null, children);
}
