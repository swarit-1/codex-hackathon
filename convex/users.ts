import { mutation, query } from "./_generated/server";
import { getDoc, insertDoc, patchDoc, queryByIndex } from "./lib/db";
import { userProfileGetArgs, userProfileUpsertArgs } from "./lib/validators";
import { toUserProfileRecord } from "./lib/records";
import {
  encryptCredentialVaultInProfileData,
  sanitizeProfileDataForRead,
} from "./security/encryption";
import type { JsonObject, UserProfileRecord } from "./types/contracts";

function asJsonObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as JsonObject;
}

export const upsertProfile = mutation({
  args: userProfileUpsertArgs,
  handler: async (ctx, args): Promise<UserProfileRecord> => {
    const timestamp = Date.now();
    const profileData = encryptCredentialVaultInProfileData(asJsonObject(args.profileData));

    const existingById = await getDoc<Omit<UserProfileRecord, "id">>(ctx, args.userId);

    if (existingById) {
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
        profileData: sanitizeProfileDataForRead(profileData),
      };
    }

    const existingByEmail = await queryByIndex<Omit<UserProfileRecord, "id">>(
      ctx,
      "users",
      "by_email",
      [["email", args.email]]
    );

    if (existingByEmail[0]) {
      await patchDoc(ctx, existingByEmail[0]._id, {
        name: args.name,
        email: args.email,
        eid: args.eid,
        authMethod: args.authMethod,
        profileData,
        updatedAt: timestamp,
      });

      return {
        ...toUserProfileRecord({
          ...existingByEmail[0],
          name: args.name,
          email: args.email,
          eid: args.eid,
          authMethod: args.authMethod,
          profileData,
          updatedAt: timestamp,
        } as any),
        profileData: sanitizeProfileDataForRead(profileData),
      };
    }

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
      profileData: sanitizeProfileDataForRead(profileData),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  },
});

export const getProfile = query({
  args: userProfileGetArgs,
  handler: async (ctx, args): Promise<UserProfileRecord | null> => {
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
