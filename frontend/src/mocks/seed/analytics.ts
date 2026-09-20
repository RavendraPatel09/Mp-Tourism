import type {
  AnalyticsSummary,
  AuditLogEntry,
  CategoryFootfall,
  DistrictFootfall,
  FootfallPoint,
  OriginFlow,
} from "@/lib/types";
import { categories } from "./categories";
import { destinations } from "./destinations";
import { intBetween, mulberry32 } from "./rand";

const rng = mulberry32(31415926);

/**
 * Ninety days of footfall, trending upward with a weekend cycle, and with the
 * Tier-3+4 share climbing slowly over the window — the campaign story the
 * dashboard exists to tell a tourism officer.
 */
function footfall(): FootfallPoint[] {
  const out: FootfallPoint[] = [];
  const start = new Date("2026-06-23T00:00:00.000Z");
  for (let i = 0; i < 90; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const base = 120 + i * 1.9 + (weekend ? 140 : 0) + rng() * 46;
    const total = Math.round(base);
    // Share rises from ~0.30 to ~0.42 across the window.
    const share = 0.3 + (i / 90) * 0.12 + (rng() - 0.5) * 0.04;
    const tier34 = Math.round(total * share);
    out.push({
      date: d.toISOString().slice(0, 10),
      checkIns: total,
      tier12: total - tier34,
      tier34,
    });
  }
  return out;
}

const footfallSeries = footfall();

const byDistrict: DistrictFootfall[] = Object.entries(
  destinations.reduce<Record<string, { checkIns: number; t34: number; count: number }>>(
    (acc, d) => {
      const entry = acc[d.district] ?? { checkIns: 0, t34: 0, count: 0 };
      entry.checkIns += d.checkInCount;
      if (d.tier >= 3) entry.t34 += d.checkInCount;
      entry.count += 1;
      acc[d.district] = entry;
      return acc;
    },
    {},
  ),
)
  .map(([district, v]) => ({
    district,
    checkIns: v.checkIns,
    tier34Share: +(v.t34 / v.checkIns).toFixed(2),
    destinations: v.count,
  }))
  .sort((a, b) => b.checkIns - a.checkIns);

const byCategory: CategoryFootfall[] = categories
  .map((c) => ({
    category: c.name,
    checkIns: destinations
      .filter((d) => d.categories.includes(c.slug))
      .reduce((sum, d) => sum + d.checkInCount, 0),
  }))
  .filter((c) => c.checkIns > 0)
  .sort((a, b) => b.checkIns - a.checkIns);

const originFlows: OriginFlow[] = [
  { originState: "Madhya Pradesh", visitors: 18240 },
  { originState: "Maharashtra", visitors: 6120 },
  { originState: "Uttar Pradesh", visitors: 4380 },
  { originState: "Delhi", visitors: 3940 },
  { originState: "Rajasthan", visitors: 2610 },
  { originState: "Gujarat", visitors: 2280 },
  { originState: "Chhattisgarh", visitors: 1870 },
  { originState: "Karnataka", visitors: 1320 },
  { originState: "West Bengal", visitors: 980 },
  { originState: "Telangana", visitors: 760 },
];

const seasonality = [
  ["Jan", 4820],
  ["Feb", 5410],
  ["Mar", 3980],
  ["Apr", 2640],
  ["May", 2110],
  ["Jun", 1980],
  ["Jul", 3240],
  ["Aug", 4160],
  ["Sep", 4890],
  ["Oct", 6720],
  ["Nov", 7410],
  ["Dec", 6980],
].map(([month, checkIns]) => ({ month: month as string, checkIns: checkIns as number }));

/** Campaign lift for "Monsoon on the Narmada" — the 2× multiplier window. */
const campaignLift = [
  { destination: "Amarkantak", before: 214, after: 796, liftPct: 272 },
  { destination: "Bhedaghat & Dhuandhar", before: 1180, after: 2340, liftPct: 98 },
  { destination: "Maheshwar", before: 340, after: 1088, liftPct: 220 },
  { destination: "Omkareshwar", before: 1420, after: 2190, liftPct: 54 },
  { destination: "Mandu", before: 620, after: 1810, liftPct: 192 },
];

const totalCheckIns = footfallSeries.reduce((s, p) => s + p.checkIns, 0);
const totalTier34 = footfallSeries.reduce((s, p) => s + p.tier34, 0);

export const analytics: AnalyticsSummary = {
  totalCheckIns,
  tier34Share: +(totalTier34 / totalCheckIns).toFixed(3),
  tier34Target: 0.35,
  uniqueDestinationsVisited: destinations.length,
  publishedDestinations: destinations.length,
  activeExplorers: 4218,
  pendingModeration: 10,
  avgReviewHours: 7.4,
  footfall: footfallSeries,
  byDistrict,
  byCategory,
  originFlows,
  seasonality,
  campaignLift,
};

/* --------------------------------------------------------- audit log */

const ACTIONS: [string, string, string][] = [
  ["destination.publish", "destination", "Published Ginnorgarh Fort after tier review"],
  ["destination.update", "destination", "Updated visitor info and hazard flags on Patalkot"],
  ["moderation.approve", "check_in", "Approved check-in at Bateshwar after manual scene review"],
  ["moderation.reject", "check_in", "Rejected check-in — pHash duplicate at Hamming distance 3"],
  ["challenge.create", "challenge", "Created 'Off the Map — September', national scope"],
  ["destination.tier_change", "destination", "Kuno National Park moved Tier 4 → Tier 3 at quarterly review"],
  ["user.enforce", "user", "Issued warning and reversed 150 points for a collusion pattern"],
  ["destination.suppress", "destination", "Temporarily suppressed promotion of Patalkot — eco-sensitive load"],
  ["media.approve", "media", "Approved 14 community photos into the Chanderi gallery"],
  ["challenge.update", "challenge", "Extended Bundelkhand Fort Challenge end date to 31 Dec"],
  ["destination.create", "destination", "Created draft listing for Hinglajgarh Fort, Mandsaur"],
  ["analytics.export", "report", "Exported Q3 redistribution report as CSV"],
  ["user.enforce", "user", "Leaderboard suspension, 30 days, for repeated mock-location submissions"],
  ["moderation.approve", "check_in", "Bulk approved 22 items from the low-risk queue"],
  ["destination.update", "destination", "Corrected geofence radius at Bhimkund from 600 m to 250 m"],
  ["media.reject", "media", "Rejected 3 photos — identifiable minors, per PRD §11"],
  ["destination.publish", "destination", "Published Dhamnar Rock-Cut Caves"],
  ["challenge.create", "challenge", "Created 'Khajuraho Dance Festival Week', scheduled February 2027"],
];

const ACTORS: [string, AuditLogEntry["actorRole"]][] = [
  ["r.patel", "super_admin"],
  ["s.iyer", "state_admin"],
  ["mod.kabir", "moderator"],
  ["mod.ananya", "moderator"],
  ["mp.tourism.admin", "state_admin"],
];

export const auditLogs: AuditLogEntry[] = ACTIONS.map((a, i) => {
  const [actor, actorRole] = ACTORS[i % ACTORS.length];
  const created = new Date("2026-09-20T08:00:00.000Z");
  created.setHours(created.getHours() - i * 5 - intBetween(rng, 0, 4));
  return {
    id: `audit-${i + 1}`,
    actor,
    actorRole,
    action: a[0],
    entity: a[1],
    entityId: `${a[1]}-${1000 + i}`,
    summary: a[2],
    ip: `10.24.${intBetween(rng, 0, 255)}.${intBetween(rng, 1, 254)}`,
    createdAt: created.toISOString(),
  };
});
