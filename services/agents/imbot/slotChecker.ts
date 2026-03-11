/**
 * Checks whether a specific sport/division/time slot still has spots available
 * and whether registration is still open. In mock mode, returns deterministic results.
 */

export interface SlotCheckResult {
  available: boolean;
  spotsRemaining: number;
  registrationOpen: boolean;
  message: string;
}

/**
 * Check if a specific slot is still available for registration.
 * In production, this hits IMLeagues to verify real-time availability.
 * The `attempt` param controls mock behavior for testing.
 */
export function checkSlotAvailability(
  attempt: number,
  options: {
    slotAvailableOnAttempt?: number;
    forceFullOnAttempt?: number;
  } = {}
): SlotCheckResult {
  const availableOn = options.slotAvailableOnAttempt ?? 1;
  const fullOn = options.forceFullOnAttempt ?? -1;

  if (attempt === fullOn) {
    return {
      available: false,
      spotsRemaining: 0,
      registrationOpen: true,
      message: "Slot is full — no spots remaining",
    };
  }

  if (attempt >= availableOn) {
    return {
      available: true,
      spotsRemaining: Math.max(1, 6 - attempt),
      registrationOpen: true,
      message: "Slot available for registration",
    };
  }

  return {
    available: false,
    spotsRemaining: 0,
    registrationOpen: false,
    message: "Registration not yet open for this slot",
  };
}
