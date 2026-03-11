import { mutation, query } from "./_generated/server";
import { getDoc, insertDoc, patchDoc, queryByIndex } from "./lib/db";
import { validationError } from "./lib/errors";
import {
  userProfileCreateArgs,
  userProfileGetArgs,
  userProfileUpdateArgs,
  userProfileUpsertArgs,
} from "./lib/validators";
import { toUserProfileRecord } from "./lib/records";
import {
  encryptCredentialVaultInProfileData,
  sanitizeProfileDataForRead,
} from "./security/encryption";
import {
  assertCanActForUserId,
  assertUserOwnsResource,
  resolveActingUserId,
} from "./security/authz";
import type { JsonObject, UserProfileRecord } from "./types/contracts";

function asJsonObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as JsonObject;
}

function sanitizeForRead(profileData: JsonObject | undefined) {
  return sanitizeProfileDataForRead(profileData);
}

async function assertEmailAvailable(
  ctx: any,
  email: string,
  currentUserId?: string
): Promise<void> {
  const existingByEmail = await queryByIndex<Omit<UserProfileRecord, "id">>(
    ctx,
    "users",
    "by_email",
    [["email", email]]
  );

  if (!existingByEmail[0]) {
    return;
  }

  if (currentUserId && existingByEmail[0]._id === currentUserId) {
    return;
  }

  throw validationError("email already belongs to a different user", {
    email,
    existingUserId: String(existingByEmail[0]._id),
    ...(currentUserId ? { requestedUserId: currentUserId } : {}),
  });
}

async function doCreateProfile(ctx: any, args: any): Promise<UserProfileRecord> {
  await assertEmailAvailable(ctx, args.email);

  const timestamp = Date.now();
  const profileData = await encryptCredentialVaultInProfileData(asJsonObject(args.profileData));
  const id = await insertDoc(ctx, "users", {
    name: args.name,
    email: args.email,
    eid: args.eid,
    authMethod: args.authMethod,
    profileData,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return {
    id,
    name: args.name,
    email: args.email,
    eid: args.eid,
    authMethod: args.authMethod,
    profileData: sanitizeForRead(profileData),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function doUpdateProfile(ctx: any, args: any): Promise<UserProfileRecord> {
  const actingUserId = await resolveActingUserId(ctx, args.userId);
  await assertCanActForUserId(ctx, actingUserId, args.userId);

  const existingById = await getDoc<Omit<UserProfileRecord, "id">>(ctx, args.userId);

  if (!existingById) {
    throw validationError("user does not exist", {
      userId: args.userId,
    });
  }

  await assertEmailAvailable(ctx, args.email, args.userId);

  const timestamp = Date.now();
  const profileData = await encryptCredentialVaultInProfileData(asJsonObject(args.profileData));

  await patchDoc(ctx, args.userId, {
    name: args.name,
    email: args.email,
    eid: args.eid,
    authMethod: args.authMethod,
    profileData,
    updatedAt: timestamp,
  });

  return {
    ...toUserProfileRecord({
      ...existingById,
      name: args.name,
      email: args.email,
      eid: args.eid,
      authMethod: args.authMethod,
      profileData,
      updatedAt: timestamp,
    } as any),
    profileData: sanitizeForRead(profileData),
  };
}

export const createProfile = mutation({
  args: userProfileCreateArgs,
  handler: async (ctx, args): Promise<UserProfileRecord> => {
    return doCreateProfile(ctx, args);
  },
});

export const updateProfile = mutation({
  args: userProfileUpdateArgs,
  handler: async (ctx, args): Promise<UserProfileRecord> => {
    return doUpdateProfile(ctx, args);
  },
});

export const upsertProfile = mutation({
  args: userProfileUpsertArgs,
  handler: async (ctx, args): Promise<UserProfileRecord> => {
    const existingById = await getDoc<Omit<UserProfileRecord, "id">>(ctx, args.userId);

    if (!existingById) {
      return doCreateProfile(ctx, args);
    }

    return doUpdateProfile(ctx, args);
  },
});

export const getProfile = query({
  args: userProfileGetArgs,
  handler: async (ctx, args): Promise<UserProfileRecord | null> => {
    const actingUserId = await resolveActingUserId(ctx, args.userId);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    const user = await getDoc<Omit<UserProfileRecord, "id">>(ctx, args.userId);

    if (!user) {
      return null;
    }

    const record = toUserProfileRecord(user as any);
    return {
      ...record,
      profileData: sanitizeProfileDataForRead(asJsonObject(record.profileData)),
    };
  },
});
