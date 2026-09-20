/**
 * The points and tier model — PRD §5.2 F11/F12 and Appendix A.
 *
 * This is the one piece of frontend logic where being wrong misleads the user
 * about what a trip is worth, so it is pure, exported and unit-tested.
 */

import type { LevelName, Tier } from "./types";

/** Base points per tier. Inverted against popularity — that is the product. */
export const TIER_POINTS: Record<Tier, number> = {
  1: 10,
  2: 30,
  3: 75,
  4: 150,
};

export const TIER_META: Record<
  Tier,
  { label: string; definition: string; example: string }
> = {
  1: {
    label: "Tier 1 · Marquee",
    definition: "Over 1M visitors a year, nationally iconic",
    example: "Khajuraho, Mahakaleshwar",
  },
  2: {
    label: "Tier 2 · Well known",
    definition: "200k–1M visitors, regionally well known",
    example: "Orchha, Pachmarhi",
  },
  3: {
    label: "Tier 3 · Lesser known",
    definition: "20k–200k visitors, known locally but little outside footfall",
    example: "Bhojpur, Chanderi",
  },
  4: {
    label: "Tier 4 · Offbeat",
    definition: "Under 20k visitors — remote, newly listed or undocumented",
    example: "Minor forts, craft villages, unlisted waterfalls",
  },
};

export const POINT_ACTIONS = [
  { label: "Verified check-in — Tier 1", points: 10 },
  { label: "Verified check-in — Tier 2", points: 30 },
  { label: "Verified check-in — Tier 3", points: 75 },
  { label: "Verified check-in — Tier 4", points: 150 },
  { label: "Photo accepted into the destination gallery", points: 25 },
  { label: "First-ever check-in at a destination (Pioneer)", points: 100 },
  { label: "Detailed review (100+ characters, with a photo)", points: 15 },
  { label: "Completing a circuit or challenge", points: 200, max: 1000 },
  { label: "Eco-pledge honoured / clean-up drive", points: 50 },
] as const;

export const MULTIPLIERS = [
  { label: "Off-season visit", value: 1.5 },
  { label: "Monsoon-only site, in season", value: 1.5 },
  { label: "State challenge active", value: 2 },
  { label: "Newly listed destination (first 90 days)", value: 2 },
] as const;

/** Cumulative point thresholds for each level. PRD F12. */
export const LEVELS: { level: number; name: LevelName; minPoints: number }[] = [
  { level: 1, name: "Explorer", minPoints: 0 },
  { level: 2, name: "Wanderer", minPoints: 500 },
  { level: 3, name: "Pathfinder", minPoints: 2_000 },
  { level: 4, name: "Trailblazer", minPoints: 5_000 },
  { level: 5, name: "Voyager", minPoints: 12_000 },
  { level: 6, name: "Legend", minPoints: 30_000 },
];

export function levelForPoints(points: number) {
  let current = LEVELS[0];
  for (const entry of LEVELS) {
    if (points >= entry.minPoints) current = entry;
  }
  const next = LEVELS.find((l) => l.level === current.level + 1);
  return {
    level: current.level,
    name: current.name,
    minPoints: current.minPoints,
    nextName: next?.name ?? null,
    nextAt: next?.minPoints ?? null,
    pointsToNext: next ? Math.max(0, next.minPoints - points) : 0,
    progressPct: next
      ? Math.min(
          100,
          Math.round(
            ((points - current.minPoints) / (next.minPoints - current.minPoints)) *
              100,
          ),
        )
      : 100,
  };
}

/** Local Guide unlocks at L5 — PRD §4.2. */
export const LOCAL_GUIDE_LEVEL = 5;

export function tierLabel(tier: Tier) {
  return TIER_META[tier].label;
}

/** Tier colour tokens, defined once so pins, badges and charts always agree. */
export const TIER_COLOR: Record<Tier, string> = {
  1: "var(--color-tier-1)",
  2: "var(--color-tier-2)",
  3: "var(--color-tier-3)",
  4: "var(--color-tier-4)",
};

export const TIER_CLASS: Record<Tier, string> = {
  1: "bg-tier-1/12 text-tier-1 ring-tier-1/25",
  2: "bg-tier-2/12 text-tier-2 ring-tier-2/25",
  3: "bg-tier-3/14 text-tier-3 ring-tier-3/30",
  4: "bg-tier-4/16 text-tier-4 ring-tier-4/35",
};
