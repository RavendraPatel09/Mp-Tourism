/**
 * Server-side data access for React Server Components.
 *
 * Mirrors the browser client exactly, but when no remote API is configured it
 * reads the mock store in-process instead of round-tripping through our own
 * route handlers. That keeps SSR and static generation fast and avoids the
 * absolute-URL problem at build time. Point NEXT_PUBLIC_API_BASE_URL at the
 * real API and these calls go over HTTP with no change at the call sites.
 */

import "server-only";

import { REMOTE_API_BASE } from "./config";
import { serializeDestinationQuery } from "./params";
import * as db from "@/mocks/db";
import type {
  AnalyticsSummary,
  Category,
  Challenge,
  Circuit,
  Destination,
  DestinationQuery,
  DestinationSummary,
  District,
  LeaderboardEntry,
  Paginated,
  Review,
  StateSummary,
  UserProfile,
} from "@/lib/types";

async function remote<T>(path: string): Promise<T> {
  const res = await fetch(`${REMOTE_API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export const serverApi = {
  async states(): Promise<StateSummary[]> {
    return REMOTE_API_BASE ? remote("/states") : db.listStates();
  },

  async state(code: string): Promise<StateSummary | undefined> {
    if (!REMOTE_API_BASE) return db.getState(code);
    const all = await remote<StateSummary[]>("/states");
    return all.find((s) => s.code.toLowerCase() === code.toLowerCase());
  },

  async districts(code: string): Promise<District[]> {
    return REMOTE_API_BASE
      ? remote(`/states/${code}/districts`)
      : db.listDistricts(code);
  },

  async categories(): Promise<Category[]> {
    return REMOTE_API_BASE ? remote("/categories") : db.listCategories();
  },

  async destinations(q: DestinationQuery = {}): Promise<Paginated<DestinationSummary>> {
    if (!REMOTE_API_BASE) return db.queryDestinations(q);
    const qs = serializeDestinationQuery(q).toString();
    return remote(`/destinations${qs ? `?${qs}` : ""}`);
  },

  async destination(slug: string): Promise<Destination | undefined> {
    if (!REMOTE_API_BASE) return db.getDestination(slug);
    try {
      return await remote<Destination>(`/destinations/${slug}`);
    } catch {
      return undefined;
    }
  },

  async nearby(slug: string, radius = 100): Promise<DestinationSummary[]> {
    return REMOTE_API_BASE
      ? remote(`/destinations/${slug}/nearby?radius=${radius}`)
      : db.nearbyDestinations(slug, radius);
  },

  async reviews(slug: string): Promise<Review[]> {
    return REMOTE_API_BASE
      ? remote(`/destinations/${slug}/reviews`)
      : db.reviewsForDestination(slug);
  },

  async circuits(): Promise<Circuit[]> {
    return REMOTE_API_BASE ? remote("/circuits") : db.listCircuits();
  },

  async circuit(slug: string): Promise<Circuit | undefined> {
    if (!REMOTE_API_BASE) return db.getCircuit(slug);
    try {
      return await remote<Circuit>(`/circuits/${slug}`);
    } catch {
      return undefined;
    }
  },

  async leaderboard(opts: {
    scope?: "national" | "state";
    state?: string;
    period?: "month" | "all";
    limit?: number;
  } = {}): Promise<LeaderboardEntry[]> {
    if (!REMOTE_API_BASE) return db.getLeaderboard(opts);
    const p = new URLSearchParams();
    if (opts.scope) p.set("scope", opts.scope);
    if (opts.state) p.set("state", opts.state);
    if (opts.period) p.set("period", opts.period);
    return remote(`/leaderboards?${p.toString()}`);
  },

  async challenges(opts: { scope?: string; state?: string; active?: boolean } = {}): Promise<Challenge[]> {
    if (!REMOTE_API_BASE) return db.listChallenges(opts);
    const p = new URLSearchParams();
    if (opts.scope) p.set("scope", opts.scope);
    if (opts.state) p.set("state", opts.state);
    if (opts.active) p.set("active", "true");
    return remote(`/challenges?${p.toString()}`);
  },

  async challenge(slug: string): Promise<Challenge | undefined> {
    if (!REMOTE_API_BASE) return db.getChallenge(slug);
    try {
      return await remote<Challenge>(`/challenges/${slug}`);
    } catch {
      return undefined;
    }
  },

  async profile(username: string): Promise<UserProfile | undefined> {
    if (!REMOTE_API_BASE) return db.getProfile(username);
    try {
      return await remote<UserProfile>(`/users/${username}`);
    } catch {
      return undefined;
    }
  },

  async search(q: string): Promise<DestinationSummary[]> {
    return REMOTE_API_BASE
      ? remote(`/search?q=${encodeURIComponent(q)}`)
      : db.search(q);
  },

  async analytics(): Promise<AnalyticsSummary> {
    return REMOTE_API_BASE ? remote("/admin/analytics") : db.getAnalytics();
  },
};
