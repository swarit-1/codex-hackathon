import { mutation, query } from "./_generated/server";
import { getDoc, insertDoc, patchDoc, queryByIndex } from "./lib/db";
import { invalidStateError, validationError } from "./lib/errors";
import { toUserProfileRecord } from "./lib/records";
import {
  authGetCurrentUserArgs,
  authSignInArgs,
  authSignOutArgs,
  authSignUpArgs,
} from "./lib/validators";
import { sanitizeProfileDataForRead } from "./security/encryption";
import {
  generatePasswordSalt,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "./security/passwords";
import type {
  AuthSessionRecord,
  AuthSessionResult,
  JsonObject,
  UserCredentialRecord,
  UserProfileRecord,
} from "./types/contracts";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function asJsonObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as JsonObject;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function getCredentialByEmail(
  ctx: any,
  email: string
): Promise<(Omit<UserCredentialRecord, "id"> & { _id: string }) | null> {
  const credentials = await queryByIndex<Omit<UserCredentialRecord, "id">>(
    ctx,
    "userCredentials",
    "by_email",
    [["email", email]]
  );

  return (credentials[0] as (Omit<UserCredentialRecord, "id"> & { _id: string }) | undefined) ?? null;
}

async function getSessionByToken(
  ctx: any,
  sessionToken: string
): Promise<(Omit<AuthSessionRecord, "id"> & { _id: string }) | null> {
  const tokenHash = await hashSessionToken(sessionToken);
  const sessions = await queryByIndex<Omit<AuthSessionRecord, "id">>(
    ctx,
    "authSessions",
    "by_tokenHash",
    [["tokenHash", tokenHash]]
  );

  return (sessions[0] as (Omit<AuthSessionRecord, "id"> & { _id: string }) | undefined) ?? null;
}

async function createSession(
  ctx: any,
  userId: string,
  existingSessionId?: string
): Promise<{ sessionToken: string; expiresAt: number }> {
  const timestamp = Date.now();
  const sessionToken = generateSessionToken();
  const tokenHash = await hashSessionToken(sessionToken);
  const expiresAt = timestamp + SESSION_TTL_MS;

  if (existingSessionId) {
    await patchDoc(ctx, existingSessionId, {
      tokenHash,
      expiresAt,
      revokedAt: undefined,
      updatedAt: timestamp,
    });
  } else {
    await insertDoc(ctx, "authSessions", {
      userId,
      tokenHash,
      expiresAt,
      revokedAt: undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return {
    sessionToken,
    expiresAt,
  };
}

async function buildSessionResult(
  ctx: any,
  userId: string,
  session: { sessionToken: string; expiresAt: number }
): Promise<AuthSessionResult> {
  const userDoc = await getDoc<Omit<UserProfileRecord, "id">>(ctx, userId);

  if (!userDoc) {
    throw invalidStateError("user record is missing for authenticated session", {
      userId,
    });
  }

  const user = toUserProfileRecord(userDoc as any);

  return {
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
    user: {
      ...user,
      profileData: sanitizeProfileDataForRead(asJsonObject(user.profileData)),
    },
  };
}

export const signUp = mutation({
  args: authSignUpArgs,
  handler: async (ctx, args): Promise<AuthSessionResult> => {
    const email = normalizeEmail(args.email);
    const existingUser = await queryByIndex<Omit<UserProfileRecord, "id">>(
      ctx,
      "users",
      "by_email",
      [["email", email]]
    );

    if (existingUser[0]) {
      throw validationError("email already belongs to an existing account", {
        email,
      });
    }

    const passwordSalt = generatePasswordSalt();
    const passwordHash = await hashPassword(args.password, passwordSalt);
    const timestamp = Date.now();
    const userId = await insertDoc(ctx, "users", {
      name: args.name.trim(),
      email,
      eid: args.eid,
      authMethod: "email",
      profileData: asJsonObject(args.profileData),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await insertDoc(ctx, "userCredentials", {
      userId,
      email,
      passwordHash,
      passwordSalt,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const session = await createSession(ctx, userId);
    return buildSessionResult(ctx, userId, session);
  },
});

export const signIn = mutation({
  args: authSignInArgs,
  handler: async (ctx, args): Promise<AuthSessionResult> => {
    const email = normalizeEmail(args.email);
    const credential = await getCredentialByEmail(ctx, email);

    if (!credential) {
      throw validationError("invalid email or password", {
        email,
      });
    }

    const passwordMatches = await verifyPassword(
      args.password,
      credential.passwordSalt,
      credential.passwordHash
    );

    if (!passwordMatches) {
      throw validationError("invalid email or password", {
        email,
      });
    }

    const existingSessions = await queryByIndex<Omit<AuthSessionRecord, "id">>(
      ctx,
      "authSessions",
      "by_userId",
      [["userId", credential.userId]]
    );
    const activeSession = existingSessions.find(
      (session) => !session.revokedAt && session.expiresAt > Date.now()
    );
    const session = await createSession(
      ctx,
      credential.userId,
      activeSession ? String((activeSession as any)._id) : undefined
    );

    return buildSessionResult(ctx, credential.userId, session);
  },
});

export const signOut = mutation({
  args: authSignOutArgs,
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const session = await getSessionByToken(ctx, args.sessionToken);

    if (!session || session.revokedAt) {
      return { success: true };
    }

    await patchDoc(ctx, String(session._id), {
      revokedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const getCurrentUser = query({
  args: authGetCurrentUserArgs,
  handler: async (ctx, args): Promise<UserProfileRecord | null> => {
    const session = await getSessionByToken(ctx, args.sessionToken);

    if (!session || session.revokedAt || session.expiresAt <= Date.now()) {
      return null;
    }

    const userDoc = await getDoc<Omit<UserProfileRecord, "id">>(ctx, session.userId);

    if (!userDoc) {
      return null;
    }

    const user = toUserProfileRecord(userDoc as any);
    return {
      ...user,
      profileData: sanitizeProfileDataForRead(asJsonObject(user.profileData)),
    };
  },
});
