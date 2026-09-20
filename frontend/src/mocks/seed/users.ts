import { levelForPoints } from "@/lib/points";
import type {
  AdminUser,
  Badge,
  CheckInSummary,
  LeaderboardEntry,
  UserProfile,
} from "@/lib/types";
import { badges } from "./badges";
import { destinations } from "./destinations";
import { intBetween, mulberry32, pick } from "./rand";

const AVATAR_COLORS = [
  "#3b4ea8",
  "#b4562f",
  "#2f7d6a",
  "#8a4b8f",
  "#a8823b",
  "#4a6ea8",
  "#9c3f5a",
  "#3f7a3f",
];

const NAMES: [string, string, string][] = [
  ["aarav_rides", "Aarav Deshmukh", "MP"],
  ["sneha.plans", "Sneha Iyer", "KA"],
  ["offbeat_ritu", "Ritu Baghel", "MP"],
  ["kabir_walks", "Kabir Ahmed", "MP"],
  ["thelongtail", "Meera Nair", "MH"],
  ["fortfinder", "Devendra Singh", "MP"],
  ["monsoonsoul", "Ananya Bose", "WB"],
  ["chambal_kid", "Vikram Tomar", "MP"],
  ["saree_and_stone", "Latika Jain", "MP"],
  ["satpura_sam", "Samar Uike", "MP"],
  ["ghatwalker", "Nikhil Rao", "TG"],
  ["earlylight", "Pooja Shrivastava", "MP"],
  ["gondwana_trails", "Rajesh Markam", "MP"],
  ["pathfinder_zo", "Zoya Qureshi", "MP"],
  ["rock_reader", "Harsh Vardhan", "UP"],
  ["tier4only", "Ishaan Chouhan", "MP"],
  ["niwari_notes", "Preeti Yadav", "MP"],
  ["denwa_diaries", "Arjun Kale", "MH"],
  ["stepwellhunter", "Fatima Sheikh", "MP"],
  ["bagh_print", "Suresh Khatri", "MP"],
  ["kuno_watcher", "Tanvi Rathore", "RJ"],
  ["maikal_mist", "Om Prakash Sahu", "CG"],
  ["shikhara", "Divya Pandey", "MP"],
  ["ravine_runner", "Manoj Gurjar", "MP"],
  ["quietmiles", "Neha Thakur", "MP"],
];

const rng = mulberry32(20260920);

/**
 * Leaderboard entries are generated once, deterministically. Points are skewed
 * so that the top of the board is held by explorers with a high Tier-3+4 share
 * — the ranking has to visibly reward the behaviour the product is trying to
 * cause, or the leaderboard argues against the points table.
 */
function makeEntries(): LeaderboardEntry[] {
  const raw = NAMES.map(([username, displayName, stateCode], i) => {
    const tier34Share = 0.34 + rng() * 0.58;
    const checkIns = intBetween(rng, 18, 140);
    // Higher Tier-3+4 share earns more per check-in, by construction.
    const avgPerCheckIn = 22 + tier34Share * 118;
    const points = Math.round(checkIns * avgPerCheckIn);
    return {
      username,
      displayName,
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      stateCode,
      points,
      checkIns,
      tier34Share: +tier34Share.toFixed(2),
    };
  });

  return raw
    .sort((a, b) => b.points - a.points)
    .map((e, i) => {
      const lvl = levelForPoints(e.points);
      return {
        ...e,
        rank: i + 1,
        level: lvl.level,
        levelName: lvl.name,
        isCurrentUser: e.username === "aarav_rides",
      };
    });
}

export const leaderboard: LeaderboardEntry[] = makeEntries();

export const leaderboardByUsername = new Map(
  leaderboard.map((e) => [e.username, e]),
);

/* --------------------------------------------------------- profiles */

const profileRng = mulberry32(882014);

function recentCheckIns(username: string, count: number): CheckInSummary[] {
  const r = mulberry32(
    username.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
  );
  // Weight the sample toward Tier 3 and 4 so profiles read like the product works.
  const pool = destinations.filter((d) => (d.tier >= 3 ? true : r() > 0.55));
  const chosen: CheckInSummary[] = [];
  const used = new Set<string>();
  let day = 0;
  while (chosen.length < count && used.size < pool.length) {
    const d = pick(r, pool);
    if (used.has(d.slug)) continue;
    used.add(d.slug);
    day += intBetween(r, 4, 26);
    const date = new Date("2026-09-14T09:30:00.000Z");
    date.setDate(date.getDate() - day);
    chosen.push({
      id: `checkin-${username}-${d.slug}`,
      destinationSlug: d.slug,
      destinationName: d.name,
      stateCode: d.stateCode,
      tier: d.tier,
      pointsAwarded: d.basePoints,
      status: "approved",
      capturedAt: date.toISOString(),
      photoUrl: `bt://gradient/${d.slug}-checkin`,
    });
  }
  return chosen;
}

function earnedBadges(username: string, count: number): Badge[] {
  const r = mulberry32(
    username.split("").reduce((a, c) => a + c.charCodeAt(0) * 7, 0),
  );
  const shuffled = [...badges].sort(() => r() - 0.5);
  return shuffled.slice(0, count).map((b, i) => {
    const date = new Date("2026-09-01T00:00:00.000Z");
    date.setDate(date.getDate() - i * intBetween(r, 6, 40));
    return { ...b, earnedAt: date.toISOString() };
  });
}

export function buildProfile(username: string): UserProfile | undefined {
  const entry = leaderboardByUsername.get(username);
  if (!entry) return undefined;
  const lvl = levelForPoints(entry.points);
  const checkIns = recentCheckIns(username, Math.min(12, entry.checkIns));
  const tier34 = Math.round(entry.checkIns * entry.tier34Share);
  const statesVisited =
    entry.points > 9000
      ? ["MP", "RJ", "MH", "CG", "UP", "GJ"]
      : entry.points > 5000
        ? ["MP", "CG", "MH"]
        : ["MP"];

  return {
    username: entry.username,
    displayName: entry.displayName,
    avatarColor: entry.avatarColor,
    homeState: entry.stateCode,
    level: lvl.level,
    levelName: lvl.name,
    totalPoints: entry.points,
    pointsToNextLevel: lvl.pointsToNext,
    joinedAt: "2026-02-11T00:00:00.000Z",
    statesVisited,
    stats: {
      checkIns: entry.checkIns,
      destinations: Math.round(entry.checkIns * 0.86),
      tier34CheckIns: tier34,
      photosAccepted: Math.round(entry.checkIns * 0.7),
      reviews: Math.round(entry.checkIns * 0.3),
      pioneerCount: Math.max(0, Math.round((entry.tier34Share - 0.5) * 14)),
    },
    badges: earnedBadges(username, Math.min(12, 3 + Math.floor(lvl.level * 1.8))),
    recentCheckIns: checkIns,
  };
}

/* ------------------------------------------------------ admin users */

export const adminUsers: AdminUser[] = leaderboard.map((e, i) => {
  const rejected = intBetween(profileRng, 0, 6);
  const trust = Math.max(
    12,
    Math.min(99, Math.round(96 - rejected * 11 + profileRng() * 8)),
  );
  return {
    id: `user-${e.username}`,
    username: e.username,
    displayName: e.displayName,
    avatarColor: e.avatarColor,
    role:
      i === 0
        ? "verified_explorer"
        : e.level >= 5
          ? "local_guide"
          : "explorer",
    stateCode: e.stateCode,
    trustScore: trust,
    totalPoints: e.points,
    checkIns: e.checkIns,
    rejectedCheckIns: rejected,
    isPhoneVerified: trust > 40,
    status: trust < 35 ? "warned" : "active",
    joinedAt: "2026-02-11T00:00:00.000Z",
  };
});

/** The signed-in explorer used across the public surface while auth is mocked. */
export const CURRENT_USERNAME = "aarav_rides";
