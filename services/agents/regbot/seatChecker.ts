export interface SeatCheckResult {
  available: boolean;
  seatsOpen: number;
  uniqueId?: string;
  courseNumber?: string;
}

export interface SeatCheckConfig {
  seatAvailableOnAttempt?: number;
  uniqueId?: string;
  courseNumber?: string;
}

export function checkSeatAvailability(attempt: number, config: SeatCheckConfig): SeatCheckResult {
  const threshold = Math.max(1, config.seatAvailableOnAttempt ?? 1);
  const available = attempt >= threshold;
  return {
    available,
    seatsOpen: available ? 1 : 0,
    uniqueId: config.uniqueId,
    courseNumber: config.courseNumber,
  };
}
