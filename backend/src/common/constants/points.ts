/**
 * PRD §5.2 F11 and Appendix A. These are the only numbers the points engine is
 * allowed to award; anything not in `REASON_POINTS` must come from a database
 * row (challenge reward, moderator adjustment) and be recorded as such.
 */

export enum DestinationTier {
  MARQUEE = 1,
  KNOWN = 2,
  LESSER_KNOWN = 3,
  RARE = 4,
}

/** Base award for a verified check-in, by destination tier. Inverted against popularity. */
export const TIER_BASE_POINTS: Record<DestinationTier, number> = {
  [DestinationTier.MARQUEE]: 10,
  [DestinationTier.KNOWN]: 30,
  [DestinationTier.LESSER_KNOWN]: 75,
  [DestinationTier.RARE]: 150,
};

/**
 * Every ledger row carries one of these. Reason codes are a closed set so that
 * analytics and reversals can be reasoned about without parsing free text.
 */
export enum PointsReason {
  CHECK_IN = 'check_in',
  PIONEER_BONUS = 'pioneer_bonus',
  PHOTO_ACCEPTED = 'photo_accepted',
  DETAILED_REVIEW = 'detailed_review',
  CHALLENGE_COMPLETED = 'challenge_completed',
  CORRECTION_ACCEPTED = 'correction_accepted',
  ECO_PLEDGE = 'eco_pledge',
  MODERATOR_ADJUSTMENT = 'moderator_adjustment',
  REVERSAL = 'reversal',
}

/** Fixed-value awards. Check-ins and challenges are computed, so they are absent here. */
export const REASON_POINTS: Partial<Record<PointsReason, number>> = {
  [PointsReason.PIONEER_BONUS]: 100,
  [PointsReason.PHOTO_ACCEPTED]: 25,
  [PointsReason.DETAILED_REVIEW]: 15,
  [PointsReason.CORRECTION_ACCEPTED]: 20,
  [PointsReason.ECO_PLEDGE]: 50,
};

export enum PointsRefType {
  CHECK_IN = 'check_in',
  REVIEW = 'review',
  MEDIA = 'media',
  CHALLENGE = 'challenge',
  LEDGER_ENTRY = 'ledger_entry',
  MANUAL = 'manual',
}

/** Multipliers stack multiplicatively, then the result is floored. PRD §5.2 F11. */
export const MULTIPLIERS = {
  OFF_SEASON: 1.5,
  MONSOON_SITE_IN_SEASON: 1.5,
  NEW_DESTINATION: 2,
  /** Challenge multipliers come from `challenges.multiplier`, not from here. */
} as const;

/** A destination counts as "new" — and so double points — for this long after publish. */
export const NEW_DESTINATION_WINDOW_DAYS = 90;

/** PRD §5.2 F12. Cumulative lifetime points required to reach each level. */
export const LEVEL_THRESHOLDS: { level: number; name: string; minPoints: number }[] = [
  { level: 1, name: 'Explorer', minPoints: 0 },
  { level: 2, name: 'Wanderer', minPoints: 500 },
  { level: 3, name: 'Pathfinder', minPoints: 1500 },
  { level: 4, name: 'Trailblazer', minPoints: 4000 },
  { level: 5, name: 'Voyager', minPoints: 10000 },
  { level: 6, name: 'Legend', minPoints: 25000 },
];

export function levelForPoints(totalPoints: number): { level: number; name: string } {
  let current = LEVEL_THRESHOLDS[0];
  for (const threshold of LEVEL_THRESHOLDS) {
    if (totalPoints >= threshold.minPoints) current = threshold;
  }
  return { level: current.level, name: current.name };
}
