import type { ScholarshipStatus } from "../../../convex/types/contracts.ts";

export type ScholarStateEvent =
  | "match_found"
  | "start_application"
  | "missing_details"
  | "resume_with_details"
  | "submit"
  | "expire";

const TRANSITIONS: Record<ScholarshipStatus, Partial<Record<ScholarStateEvent, ScholarshipStatus>>> = {
  found: {
    start_application: "applying",
    expire: "expired",
  },
  applying: {
    missing_details: "paused",
    submit: "submitted",
    expire: "expired",
  },
  paused: {
    resume_with_details: "applying",
    expire: "expired",
  },
  submitted: {},
  expired: {},
};

export function nextScholarshipStatus(current: ScholarshipStatus, event: ScholarStateEvent): ScholarshipStatus {
  const next = TRANSITIONS[current][event];
  if (!next) {
    throw new Error(`Invalid scholarship transition from ${current} via ${event}`);
  }
  return next;
}

export function isTerminalScholarshipStatus(status: ScholarshipStatus): boolean {
  return status === "submitted" || status === "expired";
}
