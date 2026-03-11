import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { deleteDoc, insertDoc, patchDoc, queryByIndex } from "./db";
import { decryptJsonValue, encryptJsonValue } from "../security/encryption";
import type {
  ConfigEnvelope,
  JsonObject,
  RegistrationMonitorRecord,
} from "../types/contracts";

type ConvexCtx = MutationCtx | QueryCtx | ActionCtx;

type RegistrationTarget = {
  courseNumber: string;
  uniqueId: string;
  semester: string;
};

const SECRET_FIELD_KEYS = ["eidPassword"] as const;

function getCurrentConfig(config: ConfigEnvelope): Record<string, unknown> {
  return (config.currentConfig ?? config.defaultConfig ?? {}) as Record<string, unknown>;
}

function parseRegistrationTargetLine(
  line: string,
  fallbackSemester?: string
): RegistrationTarget | null {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  const parts = trimmed
    .split(/\s*\|\s*|\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  const [courseNumber, uniqueId, semester] = parts;

  if (!courseNumber || !uniqueId) {
    return null;
  }

  return {
    courseNumber,
    uniqueId,
    semester: semester ?? fallbackSemester ?? "",
  };
}

export function getRegistrationTargets(config: ConfigEnvelope): RegistrationTarget[] {
  const currentConfig = getCurrentConfig(config);
  const primaryCourseNumber =
    typeof currentConfig.courseNumber === "string" ? currentConfig.courseNumber.trim() : "";
  const primaryUniqueId =
    typeof currentConfig.uniqueId === "string" ? currentConfig.uniqueId.trim() : "";
  const primarySemester =
    typeof currentConfig.semester === "string" ? currentConfig.semester.trim() : "";
  const rawWatchlist =
    typeof currentConfig.watchlistCourses === "string"
      ? currentConfig.watchlistCourses
      : "";

  const targets: RegistrationTarget[] = [];

  if (primaryCourseNumber && primaryUniqueId && primarySemester) {
    targets.push({
      courseNumber: primaryCourseNumber,
      uniqueId: primaryUniqueId,
      semester: primarySemester,
    });
  }

  const extraTargets = rawWatchlist
    .split(/\r?\n/)
    .map((line) => parseRegistrationTargetLine(line, primarySemester))
    .filter((entry): entry is RegistrationTarget => Boolean(entry));

  const deduped = new Map<string, RegistrationTarget>();

  for (const target of [...targets, ...extraTargets]) {
    if (!target.courseNumber || !target.uniqueId || !target.semester) {
      continue;
    }

    deduped.set(`${target.uniqueId}::${target.semester}`, target);
  }

  return Array.from(deduped.values());
}

export async function prepareAgentConfigForStorage(
  config: ConfigEnvelope,
  previousConfig?: ConfigEnvelope
): Promise<ConfigEnvelope> {
  const nextCurrentConfig = {
    ...(config.currentConfig as Record<string, unknown> | undefined),
  };
  const previousCurrentConfig = previousConfig
    ? getCurrentConfig(previousConfig)
    : {};
  const previousSecrets =
    previousCurrentConfig._encryptedSecrets &&
    typeof previousCurrentConfig._encryptedSecrets === "object" &&
    !Array.isArray(previousCurrentConfig._encryptedSecrets)
      ? {
          ...(previousCurrentConfig._encryptedSecrets as Record<string, unknown>),
        }
      : {};
  const nextSecrets: Record<string, unknown> = { ...previousSecrets };

  for (const key of SECRET_FIELD_KEYS) {
    const rawValue = nextCurrentConfig[key];
    delete nextCurrentConfig[key];

    if (typeof rawValue === "string" && rawValue.trim()) {
      nextSecrets[key] = await encryptJsonValue(rawValue.trim());
      continue;
    }
  }

  if (Object.keys(nextSecrets).length > 0) {
    nextCurrentConfig._encryptedSecrets = nextSecrets;
  } else {
    delete nextCurrentConfig._encryptedSecrets;
  }

  return {
    schemaVersion: config.schemaVersion,
    inputSchema: config.inputSchema,
    defaultConfig: config.defaultConfig,
    defaultSchedule: config.defaultSchedule,
    currentConfig: nextCurrentConfig as JsonObject,
  };
}

export async function hydrateRuntimeConfig(config: ConfigEnvelope): Promise<ConfigEnvelope> {
  const currentConfig = getCurrentConfig(config);
  const nextCurrentConfig: Record<string, unknown> = { ...currentConfig };
  const encryptedSecrets =
    currentConfig._encryptedSecrets &&
    typeof currentConfig._encryptedSecrets === "object" &&
    !Array.isArray(currentConfig._encryptedSecrets)
      ? (currentConfig._encryptedSecrets as Record<string, unknown>)
      : {};

  for (const key of SECRET_FIELD_KEYS) {
    const encryptedValue = encryptedSecrets[key];

    if (!encryptedValue || typeof encryptedValue !== "object") {
      continue;
    }

    try {
      const decrypted = await decryptJsonValue(encryptedValue as any);
      if (typeof decrypted === "string") {
        nextCurrentConfig[key] = decrypted;
      }
    } catch {
      // Keep runtime resilient if a stored secret cannot be decrypted.
    }
  }

  return {
    schemaVersion: config.schemaVersion,
    inputSchema: config.inputSchema,
    defaultConfig: config.defaultConfig,
    defaultSchedule: config.defaultSchedule,
    currentConfig: nextCurrentConfig as JsonObject,
  };
}

export async function syncRegistrationMonitorsForConfig(
  ctx: MutationCtx,
  args: {
    userId: string;
    agentId: string;
    config: ConfigEnvelope;
    timestamp?: number;
  }
): Promise<void> {
  const timestamp = args.timestamp ?? Date.now();
  const targets = getRegistrationTargets(args.config);
  const currentConfig = getCurrentConfig(args.config);
  const pollIntervalMinutes =
    typeof currentConfig.pollIntervalMinutes === "number"
      ? currentConfig.pollIntervalMinutes
      : typeof currentConfig.pollIntervalMinutes === "string"
        ? Number(currentConfig.pollIntervalMinutes)
        : 10;
  const pollInterval = Number.isFinite(pollIntervalMinutes)
    ? Math.max(1, pollIntervalMinutes)
    : 10;
  const existing = await queryByIndex<Omit<RegistrationMonitorRecord, "id">>(
    ctx,
    "registrationMonitors",
    "by_agentId",
    [["agentId", args.agentId]]
  );
  const existingByKey = new Map(
    existing.map((monitor) => [
      `${String((monitor as { uniqueId: string }).uniqueId)}::${String((monitor as { semester: string }).semester)}`,
      monitor,
    ])
  );
  const desiredKeys = new Set<string>();

  for (const target of targets) {
    const key = `${target.uniqueId}::${target.semester}`;
    desiredKeys.add(key);
    const existingMonitor = existingByKey.get(key);

    if (existingMonitor) {
      await patchDoc(ctx, String((existingMonitor as { _id: string })._id), {
        courseNumber: target.courseNumber,
        uniqueId: target.uniqueId,
        semester: target.semester,
        pollInterval,
        updatedAt: timestamp,
      });
      continue;
    }

    await insertDoc(ctx, "registrationMonitors", {
      userId: args.userId,
      agentId: args.agentId,
      courseNumber: target.courseNumber,
      uniqueId: target.uniqueId,
      semester: target.semester,
      status: "watching",
      pollInterval,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  await Promise.all(
    existing
      .filter((monitor) => {
        const key = `${String((monitor as { uniqueId: string }).uniqueId)}::${String((monitor as { semester: string }).semester)}`;
        return !desiredKeys.has(key);
      })
      .map((monitor) => deleteDoc(ctx, String((monitor as { _id: string })._id)))
  );
}
