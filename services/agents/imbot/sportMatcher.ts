/**
 * Matches available intramural sports and time slots against user preferences.
 * In mock mode, returns deterministic results for testing.
 */

export interface SportListing {
  sport: string;
  division: string;
  registrationOpen: boolean;
  registrationDeadline?: string;
  playBegins?: string;
  fee: number;
  availableSlots: TimeSlot[];
}

export interface TimeSlot {
  day: string;
  time: string;
  spotsRemaining: number;
}

export interface MatchResult {
  sport: string;
  division: string;
  fee: number;
  bestSlot: TimeSlot;
  matchScore: number;
}

const MOCK_LISTINGS: SportListing[] = [
  {
    sport: "Basketball",
    division: "C",
    registrationOpen: true,
    registrationDeadline: "2026-03-25",
    playBegins: "2026-03-30",
    fee: 115,
    availableSlots: [
      { day: "Sunday", time: "6:00 PM", spotsRemaining: 4 },
      { day: "Tuesday", time: "7:00 PM", spotsRemaining: 2 },
      { day: "Thursday", time: "8:00 PM", spotsRemaining: 6 },
    ],
  },
  {
    sport: "Basketball",
    division: "B",
    registrationOpen: true,
    registrationDeadline: "2026-03-25",
    playBegins: "2026-03-30",
    fee: 115,
    availableSlots: [
      { day: "Monday", time: "7:00 PM", spotsRemaining: 3 },
      { day: "Wednesday", time: "8:00 PM", spotsRemaining: 1 },
    ],
  },
  {
    sport: "Flag Football",
    division: "C",
    registrationOpen: true,
    registrationDeadline: "2026-03-25",
    playBegins: "2026-03-30",
    fee: 130,
    availableSlots: [
      { day: "Sunday", time: "4:00 PM", spotsRemaining: 8 },
      { day: "Tuesday", time: "6:00 PM", spotsRemaining: 5 },
    ],
  },
  {
    sport: "Soccer",
    division: "C",
    registrationOpen: false,
    registrationDeadline: "2026-02-09",
    playBegins: "2026-02-16",
    fee: 130,
    availableSlots: [],
  },
  {
    sport: "Dodgeball",
    division: "C",
    registrationOpen: true,
    registrationDeadline: "2026-03-16",
    playBegins: "2026-03-23",
    fee: 110,
    availableSlots: [
      { day: "Thursday", time: "7:00 PM", spotsRemaining: 10 },
      { day: "Wednesday", time: "6:00 PM", spotsRemaining: 7 },
    ],
  },
  {
    sport: "Sand Volleyball",
    division: "C",
    registrationOpen: true,
    registrationDeadline: "2026-03-16",
    playBegins: "2026-03-23",
    fee: 110,
    availableSlots: [
      { day: "Sunday", time: "2:00 PM", spotsRemaining: 6 },
      { day: "Tuesday", time: "5:00 PM", spotsRemaining: 3 },
    ],
  },
  {
    sport: "Softball",
    division: "C",
    registrationOpen: true,
    registrationDeadline: "2026-03-16",
    playBegins: "2026-03-23",
    fee: 130,
    availableSlots: [
      { day: "Monday", time: "6:00 PM", spotsRemaining: 4 },
      { day: "Thursday", time: "5:00 PM", spotsRemaining: 2 },
    ],
  },
];

/**
 * Get all sports listings. In production this would scrape IMLeagues;
 * in mock mode returns deterministic fixtures.
 */
export function getAvailableListings(): SportListing[] {
  return MOCK_LISTINGS;
}

/**
 * Match user preferences against available listings, returning ranked results.
 */
export function matchSports(preferences: {
  sports: string[];
  division: string;
  preferredDays: string[];
  preferredTime: string;
}): MatchResult[] {
  const listings = getAvailableListings();
  const results: MatchResult[] = [];

  for (const listing of listings) {
    if (!listing.registrationOpen) continue;
    if (listing.availableSlots.length === 0) continue;

    const sportMatch = preferences.sports.some(
      (s) => s.toLowerCase() === listing.sport.toLowerCase()
    );
    if (!sportMatch) continue;

    const divisionMatch = listing.division.toLowerCase() === preferences.division.toLowerCase();
    if (!divisionMatch) continue;

    // Score and pick best slot based on day/time preference
    let bestSlot = listing.availableSlots[0];
    let bestScore = 0;

    for (const slot of listing.availableSlots) {
      let score = 0.5; // base score for matching sport + division

      const dayMatch = preferences.preferredDays.some(
        (d) => d.toLowerCase() === slot.day.toLowerCase()
      );
      if (dayMatch) score += 0.3;

      const slotHour = parseHour(slot.time);
      const prefersEvening = preferences.preferredTime.toLowerCase() === "evening";
      const prefersAfternoon = preferences.preferredTime.toLowerCase() === "afternoon";
      if (prefersEvening && slotHour >= 17) score += 0.2;
      else if (prefersAfternoon && slotHour >= 12 && slotHour < 17) score += 0.2;
      else if (!prefersEvening && !prefersAfternoon) score += 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestSlot = slot;
      }
    }

    results.push({
      sport: listing.sport,
      division: listing.division,
      fee: listing.fee,
      bestSlot,
      matchScore: Math.round(bestScore * 100) / 100,
    });
  }

  return results.sort((a, b) => b.matchScore - a.matchScore);
}

function parseHour(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 12;
  let hour = parseInt(match[1], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return hour;
}
