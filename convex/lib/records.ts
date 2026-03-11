import type {
  AgentLogRecord,
  AgentRecord,
  CustomWorkflowRecord,
  MarketplaceTemplateRecord,
  PendingActionRecord,
  RegistrationMonitorRecord,
  ScholarshipRecord,
  TemplateSubmissionRecord,
  UserProfileRecord,
} from "../types/contracts";
import type { ConvexDoc } from "./db";

function toRecord<T extends Record<string, unknown>>(doc: ConvexDoc<T>) {
  const { _id, _creationTime: _ignoredCreationTime, ...rest } = doc;
  return {
    id: String(_id),
    ...rest,
  };
}

export function toUserProfileRecord(doc: ConvexDoc<Omit<UserProfileRecord, "id">>): UserProfileRecord {
  return toRecord(doc) as UserProfileRecord;
}

export function toMarketplaceTemplateRecord(
  doc: ConvexDoc<Omit<MarketplaceTemplateRecord, "id">>
): MarketplaceTemplateRecord {
  return toRecord(doc) as MarketplaceTemplateRecord;
}

export function toTemplateSubmissionRecord(
  doc: ConvexDoc<Omit<TemplateSubmissionRecord, "id">>
): TemplateSubmissionRecord {
  return toRecord(doc) as TemplateSubmissionRecord;
}

export function toAgentRecord(doc: ConvexDoc<Omit<AgentRecord, "id">>): AgentRecord {
  return toRecord(doc) as AgentRecord;
}

export function toScholarshipRecord(
  doc: ConvexDoc<Omit<ScholarshipRecord, "id">>
): ScholarshipRecord {
  return toRecord(doc) as ScholarshipRecord;
}

export function toRegistrationMonitorRecord(
  doc: ConvexDoc<Omit<RegistrationMonitorRecord, "id">>
): RegistrationMonitorRecord {
  return toRecord(doc) as RegistrationMonitorRecord;
}

export function toPendingActionRecord(
  doc: ConvexDoc<Omit<PendingActionRecord, "id">>
): PendingActionRecord {
  return toRecord(doc) as PendingActionRecord;
}

export function toCustomWorkflowRecord(
  doc: ConvexDoc<Omit<CustomWorkflowRecord, "id">>
): CustomWorkflowRecord {
  return toRecord(doc) as CustomWorkflowRecord;
}

export function toAgentLogRecord(doc: ConvexDoc<Omit<AgentLogRecord, "id">>): AgentLogRecord {
  return toRecord(doc) as AgentLogRecord;
}
