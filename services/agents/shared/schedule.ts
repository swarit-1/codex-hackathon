export interface ScheduleValidation {
  valid: boolean;
  errors: string[];
  normalized?: string;
}

interface CronFields {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

const FIELD_NAMES = ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"] as const;
const FIELD_RANGES: Record<keyof CronFields, { min: number; max: number }> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  dayOfWeek: { min: 0, max: 6 },
};

export function validateCronSchedule(schedule: string): ScheduleValidation {
  if (!schedule || !schedule.trim()) {
    return {
      valid: false,
      errors: ["Schedule must be a non-empty 5-field cron string in UTC."],
    };
  }

  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) {
    return {
      valid: false,
      errors: [
        `Invalid cron shape: expected 5 fields (minute hour dayOfMonth month dayOfWeek), received ${parts.length}.`,
      ],
    };
  }

  const fields: CronFields = {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };

  const errors: string[] = [];
  for (const fieldName of FIELD_NAMES) {
    const value = fields[fieldName];
    const range = FIELD_RANGES[fieldName];
    if (!isWildcardOrIntegerInRange(value, range.min, range.max)) {
      errors.push(
        `${fieldName} must be '*' or an integer in range ${range.min}-${range.max}. Received '${value}'.`,
      );
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
    errors: [],
    normalized: parts.join(" "),
  };
}

export function computeNextRunAt(schedule: string, fromDate: Date = new Date()): string {
  const validation = validateCronSchedule(schedule);
  if (!validation.valid || !validation.normalized) {
    throw new Error(validation.errors.join(" "));
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = validation.normalized.split(" ");
  const start = new Date(fromDate.getTime());
  start.setUTCSeconds(0, 0);

  const maxSearchMinutes = 366 * 24 * 60;
  for (let offset = 1; offset <= maxSearchMinutes; offset += 1) {
    const candidate = new Date(start.getTime() + offset * 60_000);
    if (
      matchesField(candidate.getUTCMinutes(), minute) &&
      matchesField(candidate.getUTCHours(), hour) &&
      matchesField(candidate.getUTCDate(), dayOfMonth) &&
      matchesField(candidate.getUTCMonth() + 1, month) &&
      matchesField(candidate.getUTCDay(), dayOfWeek)
    ) {
      return candidate.toISOString();
    }
  }

  throw new Error("Could not compute next run time from schedule within a one-year search window.");
}

function isWildcardOrIntegerInRange(value: string, min: number, max: number): boolean {
  if (value === "*") {
    return true;
  }

  if (!/^\d+$/.test(value)) {
    return false;
  }

  const parsed = Number(value);
  return parsed >= min && parsed <= max;
}

function matchesField(actual: number, rule: string): boolean {
  if (rule === "*") {
    return true;
  }
  return actual === Number(rule);
}
