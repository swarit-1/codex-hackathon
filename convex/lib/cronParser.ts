/**
 * Lightweight cron expression parser for computing next fire times.
 * Supports standard 5-field cron: minute hour day-of-month month day-of-week
 * Field syntax: * | *\/N | N | N-M | N,M,... | combinations
 */

interface CronFields {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
}

function parseField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();

  for (const part of field.split(",")) {
    const trimmed = part.trim();

    if (trimmed === "*") {
      for (let i = min; i <= max; i++) values.add(i);
      continue;
    }

    // Handle */N or range/N (e.g. */10, 1-5/2)
    const stepMatch = trimmed.match(/^(\*|(\d+)-(\d+))\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[4], 10);
      const rangeStart =
        stepMatch[2] !== undefined ? parseInt(stepMatch[2], 10) : min;
      const rangeEnd =
        stepMatch[3] !== undefined ? parseInt(stepMatch[3], 10) : max;
      for (let i = rangeStart; i <= rangeEnd; i += step) {
        if (i >= min && i <= max) values.add(i);
      }
      continue;
    }

    // Handle N-M (e.g. 1-5)
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let i = start; i <= end; i++) {
        if (i >= min && i <= max) values.add(i);
      }
      continue;
    }

    // Handle plain number
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      values.add(num);
    }
  }

  return values;
}

export function parseCronExpression(expression: string): CronFields | null {
  const parts = expression.trim().split(/\s+/);

  // Support 5 or 6 fields (6th field is optional year, ignored)
  if (parts.length < 5 || parts.length > 6) {
    return null;
  }

  const minutes = parseField(parts[0], 0, 59);
  const hours = parseField(parts[1], 0, 23);
  const daysOfMonth = parseField(parts[2], 1, 31);
  const months = parseField(parts[3], 1, 12);
  const daysOfWeek = parseField(parts[4], 0, 6);

  if (
    !minutes.size ||
    !hours.size ||
    !daysOfMonth.size ||
    !months.size ||
    !daysOfWeek.size
  ) {
    return null;
  }

  return { minutes, hours, daysOfMonth, months, daysOfWeek };
}

/**
 * Get timezone offset in milliseconds for a given IANA timezone at a specific time.
 * Falls back to UTC (0) if timezone is invalid.
 */
function getTimezoneOffsetMs(timezone: string, referenceDate: Date): number {
  try {
    const utcStr = referenceDate.toLocaleString("en-US", { timeZone: "UTC" });
    const tzStr = referenceDate.toLocaleString("en-US", {
      timeZone: timezone,
    });
    return new Date(tzStr).getTime() - new Date(utcStr).getTime();
  } catch {
    return 0;
  }
}

/**
 * Compute the next fire time after `afterMs` (epoch milliseconds).
 * Respects the IANA timezone for cron field matching.
 * Returns epoch milliseconds (UTC), or undefined if the expression is invalid.
 * Searches up to 48 hours ahead.
 */
export function getNextCronTime(
  expression: string,
  afterMs: number,
  timezone: string = "UTC"
): number | undefined {
  const fields = parseCronExpression(expression);
  if (!fields) return undefined;

  const refDate = new Date(afterMs);
  const offsetMs = getTimezoneOffsetMs(timezone, refDate);

  // Work in timezone-local time by shifting
  const cursor = new Date(afterMs + offsetMs);
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

  // Search up to 48 hours (2880 minutes)
  const maxMinutes = 48 * 60;

  for (let i = 0; i < maxMinutes; i++) {
    const month = cursor.getUTCMonth() + 1;
    const dayOfMonth = cursor.getUTCDate();
    const dayOfWeek = cursor.getUTCDay();
    const hour = cursor.getUTCHours();
    const minute = cursor.getUTCMinutes();

    if (
      fields.months.has(month) &&
      fields.daysOfMonth.has(dayOfMonth) &&
      fields.daysOfWeek.has(dayOfWeek) &&
      fields.hours.has(hour) &&
      fields.minutes.has(minute)
    ) {
      // Convert back from local to UTC
      return cursor.getTime() - offsetMs;
    }

    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }

  return undefined;
}
