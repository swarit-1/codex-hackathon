import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { getDoc, queryByIndex } from "../lib/db";
import { forbiddenError, notFoundError } from "../lib/errors";
import { hashSessionToken } from "./passwords";
import type {
  AuthSessionRecord,
  AgentRecord,
  MarketplaceTemplateRecord,
  TemplateSubmissionRecord,
  UserProfileRecord,
} from "../types/contracts";

type ConvexCtx = QueryCtx | MutationCtx | ActionCtx;
type UserDoc = Omit<UserProfileRecord, "id"> & {
  _id: string;
  profileData?: Record<string, unknown>;
};

async function getUserDoc(ctx: ConvexCtx, userId: string): Promise<UserDoc> {
  const user = await getDoc<Omit<UserProfileRecord, "id">>(ctx, userId);

  if (!user) {
    throw notFoundError("user not found", {
      userId,
    });
  }

  return user as UserDoc;
}

async function getSessionUserId(
  ctx: ConvexCtx,
  sessionToken: string
): Promise<string | undefined> {
  const tokenHash = await hashSessionToken(sessionToken);
  const sessions = await queryByIndex<Omit<AuthSessionRecord, "id">>(
    ctx,
    "authSessions",
    "by_tokenHash",
    [["tokenHash", tokenHash]]
  );
  const session = sessions[0];

  if (!session || session.revokedAt || session.expiresAt <= Date.now()) {
    return undefined;
  }

  return String(session.userId);
}

async function getAuthIdentity(ctx: ConvexCtx): Promise<Record<string, unknown> | null> {
  const auth = (ctx as any).auth;

  if (!auth) {
    return null;
  }

  if (typeof auth.getUserIdentity === "function") {
    return ((await auth.getUserIdentity()) ?? null) as Record<string, unknown> | null;
  }

  if (typeof auth.getIdentity === "function") {
    return ((await auth.getIdentity()) ?? null) as Record<string, unknown> | null;
  }

  return (auth.identity ?? null) as Record<string, unknown> | null;
}

function extractUserIdFromIdentity(identity: Record<string, unknown> | null): string | undefined {
  if (!identity) {
    return undefined;
  }

  const candidate =
    identity.userId ??
    identity.subject ??
    identity.subjectId ??
    identity.tokenIdentifier ??
    identity.id;

  return typeof candidate === "string" ? candidate : undefined;
}

function getRoleSet(user: UserDoc): Set<string> {
  const profileData = user.profileData ?? {};
  const rawRoles =
    (Array.isArray(profileData.roles) ? profileData.roles : []) as unknown[];
  const explicitRole = typeof profileData.role === "string" ? profileData.role : undefined;
  const isModerator = profileData.isModerator === true;

  const roles = new Set<string>();
  rawRoles.forEach((role) => {
    if (typeof role === "string") {
      roles.add(role);
    }
  });

  if (explicitRole) {
    roles.add(explicitRole);
  }

  if (isModerator) {
    roles.add("moderator");
  }

  return roles;
}

async function assertHasElevatedRole(
  ctx: ConvexCtx,
  userId: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<UserDoc> {
  const user = await requireUser(ctx, userId);
  const roles = getRoleSet(user);

  if (!roles.has("moderator") && !roles.has("admin")) {
    throw forbiddenError(message, metadata as any);
  }

  return user;
}

export async function requireUser(ctx: ConvexCtx, userId: string): Promise<UserDoc> {
  return getUserDoc(ctx, userId);
}

export async function resolveActingUserId(
  ctx: ConvexCtx,
  fallbackUserId?: string,
  sessionToken?: string
): Promise<string | undefined> {
  const authIdentity = await getAuthIdentity(ctx);

  if (sessionToken) {
    const sessionUserId = await getSessionUserId(ctx, sessionToken);

    if (sessionUserId) {
      return sessionUserId;
    }
  }

  return extractUserIdFromIdentity(authIdentity) ?? fallbackUserId;
}

export async function assertCanActForUserId(
  ctx: ConvexCtx,
  actingUserId: string | undefined,
  targetUserId: string
): Promise<void> {
  if (!actingUserId || actingUserId === targetUserId) {
    return;
  }

  await assertHasElevatedRole(
    ctx,
    actingUserId,
    "user cannot act on behalf of another user",
    {
      actingUserId,
      targetUserId,
    }
  );
}

export async function assertUserOwnsResource(
  ctx: ConvexCtx,
  actingUserId: string | undefined,
  ownerUserId: string
): Promise<UserDoc> {
  if (!actingUserId) {
    return requireUser(ctx, ownerUserId);
  }

  const actingUser = await requireUser(ctx, actingUserId);

  const roles = getRoleSet(actingUser);

  if (actingUserId !== ownerUserId && !roles.has("moderator") && !roles.has("admin")) {
    throw forbiddenError("user cannot access resource owned by another user", {
      actingUserId,
      ownerUserId,
    });
  }

  return actingUser;
}

export async function assertModerator(ctx: ConvexCtx, reviewerId: string): Promise<UserDoc> {
  return assertHasElevatedRole(
    ctx,
    reviewerId,
    "review action requires moderator role",
    {
      reviewerId,
    }
  );
}

export async function assertCanReadTemplate(
  ctx: ConvexCtx,
  template: MarketplaceTemplateRecord,
  actingUserId?: string
): Promise<void> {
  if (template.visibility === "public" && template.archivedAt === undefined) {
    return;
  }

  if (!actingUserId) {
    throw forbiddenError("private or archived template requires owner or moderator access", {
      templateId: template.id,
    });
  }

  if (template.ownerUserId) {
    await assertUserOwnsResource(ctx, actingUserId, template.ownerUserId);
    return;
  }

  await assertHasElevatedRole(
    ctx,
    actingUserId,
    "private or archived template requires owner or moderator access",
    {
      templateId: template.id,
    }
  );
}

export async function assertCanManageTemplate(
  ctx: ConvexCtx,
  template: MarketplaceTemplateRecord,
  actingUserId: string
): Promise<void> {
  if (template.ownerUserId) {
    await assertUserOwnsResource(ctx, actingUserId, template.ownerUserId);
    return;
  }

  await assertHasElevatedRole(
    ctx,
    actingUserId,
    "template management requires owner or moderator access",
    {
      templateId: template.id,
    }
  );
}

export async function assertCanManageSubmission(
  ctx: ConvexCtx,
  submission: TemplateSubmissionRecord,
  actingUserId: string
): Promise<void> {
  await assertUserOwnsResource(ctx, actingUserId, submission.userId);
}

export async function assertCanManageAgent(
  ctx: ConvexCtx,
  agent: AgentRecord,
  actingUserId: string
): Promise<void> {
  await assertUserOwnsResource(ctx, actingUserId, agent.userId);
}
