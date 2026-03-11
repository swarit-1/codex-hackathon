import type { LabOpeningStatus } from "../../../convex/types/contracts.ts";

export type LabStateEvent =
  | "opening_found"
  | "start_review"
  | "draft_email"
  | "email_drafted"
  | "send_email"
  | "expire";

const TRANSITIONS: Record<LabOpeningStatus, Partial<Record<LabStateEvent, LabOpeningStatus>>> = {
  discovered: {
    start_review: "reviewing",
    draft_email: "drafting_email",
    expire: "expired",
  },
  reviewing: {
    draft_email: "drafting_email",
    expire: "expired",
  },
  drafting_email: {
    email_drafted: "email_ready",
    expire: "expired",
  },
  email_ready: {
    send_email: "contacted",
    draft_email: "drafting_email",
    expire: "expired",
  },
  contacted: {},
  expired: {},
};

export function nextLabOpeningStatus(current: LabOpeningStatus, event: LabStateEvent): LabOpeningStatus {
  const next = TRANSITIONS[current][event];
  if (!next) {
    throw new Error(`Invalid lab opening transition from ${current} via ${event}`);
  }
  return next;
}

export function isTerminalLabOpeningStatus(status: LabOpeningStatus): boolean {
  return status === "contacted" || status === "expired";
}
