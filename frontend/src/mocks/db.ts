/**
 * In-memory store behind the mock API.
 *
 * Every function here returns exactly the shape the real endpoint in PRD §8 is
 * contracted to return, including pagination envelopes, so the route handlers
 * stay thin and swapping to Member B's NestJS API is a config change.
 *
 * Mutations (moderation decisions, destination edits) are held in module state.
 * They survive within a server process and reset on restart, which is the right
 * behaviour for a mock — it is not a database and should not pretend to be.
 */

import { haversineKm } from "@/lib/geo";
import { DURATION_BUCKETS } from "@/lib/format";
import type {
  AdminUser,
  AnalyticsSummary,
  AuditLogEntry,
  Category,
  Challenge,
  Circuit,
  Destination,
  DestinationQuery,
  DestinationSummary,
  District,
  LeaderboardEntry,
  ModerationItem,
  Paginated,
  Review,
  StateSummary,
  Tier,
  UserProfile,
} from "@/lib/types";
import { analytics as analyticsSeed, auditLogs as auditSeed } from "./seed/analytics";
import { badges } from "./seed/badges";
import { categories } from "./seed/categories";
import { challenges } from "./seed/challenges";
import { circuits } from "./seed/circuits";
import { destinations } from "./seed/destinations";
import { moderationQueue } from "./seed/moderation";
import { reviews } from "./seed/reviews";
import { districts, states } from "./seed/states";
import { adminUsers, buildProfile, leaderboard } from "./seed/users";

/* --------------------------------------------------------- mutable state */

const destinationStore: Destination[] = destinations.map((d) => ({ ...d }));
const moderationStore: ModerationItem[] = moderationQueue.map((m) => ({ ...m }));
const challengeStore: Challenge[] = challenges.map((c) => ({ ...c }));
const auditStore: AuditLogEntry[] = [...auditSeed];

/* ---------------------------------------------------------- projections */

export function toSummary(d: Destination, distanceKm?: number): DestinationSummary {
  const {
    story: _story,
    whyGo: _whyGo,
    gallery: _gallery,
    thingsToDo: _thingsToDo,
    itinerary: _itinerary,
    info: _info,
    pointsRationale: _pr,
    geofencePolygon: _gp,
    ...summary
  } = d;
  return distanceKm === undefined ? summary : { ...summary, distanceKm };
}

/* ------------------------------------------------------------ geography */

export function listStates(): StateSummary[] {
  return states;
}

export function getState(code: string): StateSummary | undefined {
  return states.find((s) => s.code.toLowerCase() === code.toLowerCase());
}

export function listDistricts(stateCode: string): District[] {
  return districts.filter(
    (d) => d.stateCode.toLowerCase() === stateCode.toLowerCase(),
  );
}

export function listCategories(): Category[] {
  return categories;
}

/* ---------------------------------------------------------- destinations */

function matchesDuration(d: Destination, bucket: NonNullable<DestinationQuery["duration"]>) {
  const max = DURATION_BUCKETS.find((b) => b.value === bucket)?.maxMin ?? Infinity;
  // Match on the minimum viable visit — "I have 2 hours" means "can I do it at all".
  return d.minDurationMin <= max;
}

export function queryDestinations(q: DestinationQuery = {}): Paginated<DestinationSummary> {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, q.pageSize ?? 12));

  let rows = destinationStore.filter((d) => d.status === "published");

  if (q.state) rows = rows.filter((d) => d.stateCode.toLowerCase() === q.state!.toLowerCase());
  if (q.district) rows = rows.filter((d) => d.district.toLowerCase() === q.district!.toLowerCase());
  if (q.categories?.length)
    rows = rows.filter((d) => q.categories!.some((c) => d.categories.includes(c)));
  if (q.duration) rows = rows.filter((d) => matchesDuration(d, q.duration!));
  if (q.difficulty?.length) rows = rows.filter((d) => q.difficulty!.includes(d.difficulty));
  if (q.tier?.length) rows = rows.filter((d) => q.tier!.includes(d.tier));
  if (q.season)
    rows = rows.filter(
      (d) => d.bestSeasons.includes(q.season!) || d.bestSeasons.includes("year_round"),
    );
  if (q.accessible) rows = rows.filter((d) => d.accessibility.wheelchair);

  if (q.q) {
    const needle = q.q.toLowerCase().trim();
    rows = rows.filter(
      (d) =>
        d.name.toLowerCase().includes(needle) ||
        d.district.toLowerCase().includes(needle) ||
        d.shortDescription.toLowerCase().includes(needle) ||
        d.categories.some((c) => c.includes(needle)),
    );
  }

  let withDistance = rows.map((d) => ({
    row: d,
    distanceKm: q.near ? haversineKm(q.near, d.location) : undefined,
  }));

  if (q.near && q.radius) {
    withDistance = withDistance.filter((x) => (x.distanceKm ?? Infinity) <= q.radius!);
  }

  const sort = q.sort ?? "recommended";
  withDistance.sort((a, b) => {
    switch (sort) {
      case "points":
        return b.row.basePoints - a.row.basePoints;
      case "rating":
        return b.row.rating - a.row.rating;
      case "duration":
        return a.row.minDurationMin - b.row.minDurationMin;
      case "distance":
        return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      default:
        // "Recommended" deliberately favours the long tail: tier first, then
        // rating. A popularity sort would undo the entire product thesis.
        return b.row.tier - a.row.tier || b.row.rating - a.row.rating;
    }
  });

  const total = withDistance.length;
  const start = (page - 1) * pageSize;
  return {
    items: withDistance
      .slice(start, start + pageSize)
      .map((x) => toSummary(x.row, x.distanceKm)),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function getDestination(slug: string): Destination | undefined {
  return destinationStore.find((d) => d.slug === slug);
}

export function listAllDestinations(): Destination[] {
  return destinationStore;
}

/** PRD F3 "Nearby" — the redistribution engine. */
export function nearbyDestinations(slug: string, radiusKm = 100, limit = 8) {
  const origin = getDestination(slug);
  if (!origin) return [];
  return destinationStore
    .filter((d) => d.slug !== slug && d.status === "published")
    .map((d) => ({ d, km: haversineKm(origin.location, d.location) }))
    .filter((x) => x.km <= radiusKm)
    .sort((a, b) => {
      // Surface the higher-tier (less-visited) neighbours first, then by distance.
      if (b.d.tier !== a.d.tier) return b.d.tier - a.d.tier;
      return a.km - b.km;
    })
    .slice(0, limit)
    .map((x) => toSummary(x.d, +x.km.toFixed(1)));
}

export function reviewsForDestination(slug: string): Review[] {
  return reviews.filter((r) => r.destinationSlug === slug);
}

/* ---------------------------------------------------------------- search */

/**
 * Typo tolerance is server-side in the real API. Here it is a small Levenshtein
 * pass over names and aliases so the UX can be built and demoed honestly.
 */
const ALIASES: Record<string, string> = {
  khajurao: "khajuraho-monuments",
  khajuraaho: "khajuraho-monuments",
  ujain: "mahakaleshwar-ujjain",
  mahakal: "mahakaleshwar-ujjain",
  sanchi: "sanchi-stupa",
  orcha: "orchha",
  gwaliar: "gwalior-fort",
  mandav: "mandu",
  mandavgarh: "mandu",
  bhedaghat: "bhedaghat-dhuandhar",
  dhuandhar: "bhedaghat-dhuandhar",
  bhojeshwar: "bhojpur-temple",
  maheshvar: "maheshwar",
  pachmari: "pachmarhi",
  bhimbetka: "bhimbetka-rock-shelters",
  mitaoli: "chausath-yogini-mitaoli",
  padhavali: "bateshwar-temples",
};

function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[n];
}

export function search(term: string, limit = 12): DestinationSummary[] {
  const needle = term.toLowerCase().trim();
  if (!needle) return [];

  const aliasHit = ALIASES[needle];
  const scored = destinationStore
    .filter((d) => d.status === "published")
    .map((d) => {
      const name = d.name.toLowerCase();
      let score = 0;
      if (d.slug === aliasHit) score = 100;
      else if (name.startsWith(needle)) score = 90;
      else if (name.includes(needle)) score = 70;
      else if (d.district.toLowerCase().includes(needle)) score = 55;
      else if (d.categories.some((c) => c.includes(needle))) score = 45;
      else if (d.shortDescription.toLowerCase().includes(needle)) score = 35;
      else {
        // Typo tolerance: compare against each word of the name.
        const best = Math.min(
          ...name.split(/[\s,&]+/).map((w) => levenshtein(needle, w)),
        );
        if (best <= Math.max(1, Math.floor(needle.length / 4))) score = 30 - best;
      }
      return { d, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.d.tier - a.d.tier)
    .slice(0, limit);

  return scored.map((x) => toSummary(x.d));
}

/* -------------------------------------------------------------- circuits */

export function listCircuits(): Circuit[] {
  return circuits;
}

export function getCircuit(slug: string): Circuit | undefined {
  return circuits.find((c) => c.slug === slug);
}

/* ---------------------------------------------------------- gamification */

export function getLeaderboard(opts: {
  scope?: "national" | "state";
  state?: string;
  period?: "month" | "all";
  limit?: number;
} = {}): LeaderboardEntry[] {
  let rows = [...leaderboard];
  if (opts.scope === "state" && opts.state) {
    rows = rows.filter((r) => r.stateCode === opts.state);
  }
  if (opts.period === "month") {
    // A monthly board is a different window, so the ordering legitimately differs.
    rows = rows
      .map((r) => ({ ...r, points: Math.round(r.points * (0.14 + (r.tier34Share - 0.3) * 0.3)) }))
      .sort((a, b) => b.points - a.points);
  }
  return rows.slice(0, opts.limit ?? 50).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function listChallenges(opts: { scope?: string; state?: string; active?: boolean } = {}) {
  let rows = [...challengeStore];
  if (opts.scope) rows = rows.filter((c) => c.scope === opts.scope);
  if (opts.state) rows = rows.filter((c) => !c.stateCode || c.stateCode === opts.state);
  if (opts.active) rows = rows.filter((c) => c.status === "active");
  const order = { active: 0, upcoming: 1, ended: 2 } as const;
  return rows.sort((a, b) => order[a.status] - order[b.status]);
}

export function getChallenge(slug: string) {
  return challengeStore.find((c) => c.slug === slug);
}

export function listBadges() {
  return badges;
}

export function getProfile(username: string): UserProfile | undefined {
  return buildProfile(username);
}

/* ----------------------------------------------------------- moderation */

export function listModerationQueue(status: ModerationItem["status"] | "all" = "pending") {
  return status === "all"
    ? moderationStore
    : moderationStore.filter((m) => m.status === status);
}

export function getModerationItem(id: string) {
  return moderationStore.find((m) => m.id === id);
}

export function decideModeration(id: string, decision: "approved" | "rejected", reason?: string) {
  const item = moderationStore.find((m) => m.id === id);
  if (!item) return undefined;
  item.status = decision;
  auditStore.unshift({
    id: `audit-${Date.now()}`,
    actor: "mod.current",
    actorRole: "moderator",
    action: decision === "approved" ? "moderation.approve" : "moderation.reject",
    entity: "check_in",
    entityId: item.checkInId,
    summary:
      decision === "approved"
        ? `Approved check-in at ${item.destinationName} (+${item.pointsAtStake} pts)`
        : `Rejected check-in at ${item.destinationName}${reason ? ` — ${reason}` : ""}`,
    ip: "10.24.0.1",
    createdAt: new Date().toISOString(),
  });
  return item;
}

/** Undo support — the moderation console binds this to `U`. */
export function resetModeration(id: string) {
  const item = moderationStore.find((m) => m.id === id);
  if (item) item.status = "pending";
  return item;
}

/* ---------------------------------------------------------------- admin */

export function listAdminUsers(q?: string): AdminUser[] {
  if (!q) return adminUsers;
  const needle = q.toLowerCase();
  return adminUsers.filter(
    (u) =>
      u.username.toLowerCase().includes(needle) ||
      u.displayName.toLowerCase().includes(needle),
  );
}

export function getAnalytics(): AnalyticsSummary {
  return analyticsSeed;
}

export function listAuditLogs(filters: { actor?: string; entity?: string; action?: string } = {}) {
  return auditStore.filter(
    (a) =>
      (!filters.actor || a.actor === filters.actor) &&
      (!filters.entity || a.entity === filters.entity) &&
      (!filters.action || a.action.startsWith(filters.action)),
  );
}

export function upsertDestination(slug: string, patch: Partial<Destination>) {
  const i = destinationStore.findIndex((d) => d.slug === slug);
  if (i === -1) return undefined;
  destinationStore[i] = { ...destinationStore[i], ...patch, updatedAt: new Date().toISOString() };
  auditStore.unshift({
    id: `audit-${Date.now()}`,
    actor: "admin.current",
    actorRole: "state_admin",
    action: "destination.update",
    entity: "destination",
    entityId: destinationStore[i].id,
    summary: `Updated ${destinationStore[i].name}`,
    ip: "10.24.0.1",
    createdAt: new Date().toISOString(),
  });
  return destinationStore[i];
}

/** Completeness drives the CMS meter and the "% with complete visitor info" KPI. */
export function completeness(d: Destination): number {
  const checks: boolean[] = [
    d.shortDescription.length > 40,
    d.whyGo.length > 80,
    d.story.length > 200,
    d.thingsToDo.length >= 4,
    d.itinerary.stops.length >= 4,
    d.info.timings.length > 0,
    d.info.entryFees.length > 0,
    d.info.howToReach.length > 60,
    !!d.info.bestTimeOfDay,
    d.info.emergencyContacts.length > 0,
    d.gallery.length >= 3,
    d.geofenceRadiusM > 0,
    d.categories.length >= 2,
    !!d.pointsRationale,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export const TIERS: Tier[] = [1, 2, 3, 4];
