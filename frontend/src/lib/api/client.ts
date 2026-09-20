/**
 * Browser-side typed API client. One function per endpoint in PRD §8.
 *
 * Nothing in the app calls fetch directly — when the real API lands, the only
 * things that change are the base URL and, eventually, the auth header here.
 */

import { API_BASE } from "./config";
import { serializeDestinationQuery } from "./params";
import type {
  AdminUser,
  AnalyticsSummary,
  AuditLogEntry,
  Badge,
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
  UserProfile,
} from "@/lib/types";

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(body?.error?.message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function send<T>(path: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(err?.error?.message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  states: () => get<StateSummary[]>("/states"),
  districts: (code: string) => get<District[]>(`/states/${code}/districts`),
  categories: () => get<Category[]>("/categories"),

  destinations: (q: DestinationQuery = {}) => {
    const qs = serializeDestinationQuery(q).toString();
    return get<Paginated<DestinationSummary>>(`/destinations${qs ? `?${qs}` : ""}`);
  },
  destination: (slug: string) => get<Destination>(`/destinations/${slug}`),
  nearby: (slug: string, radius = 100) =>
    get<DestinationSummary[]>(`/destinations/${slug}/nearby?radius=${radius}`),
  reviews: (slug: string) => get<Review[]>(`/destinations/${slug}/reviews`),

  circuits: () => get<Circuit[]>("/circuits"),
  circuit: (slug: string) => get<Circuit>(`/circuits/${slug}`),

  search: (q: string) =>
    get<DestinationSummary[]>(`/search?q=${encodeURIComponent(q)}`),

  leaderboard: (opts: { scope?: string; state?: string; period?: string } = {}) => {
    const p = new URLSearchParams();
    if (opts.scope) p.set("scope", opts.scope);
    if (opts.state) p.set("state", opts.state);
    if (opts.period) p.set("period", opts.period);
    return get<LeaderboardEntry[]>(`/leaderboards?${p.toString()}`);
  },

  challenges: (opts: { scope?: string; state?: string; active?: boolean } = {}) => {
    const p = new URLSearchParams();
    if (opts.scope) p.set("scope", opts.scope);
    if (opts.state) p.set("state", opts.state);
    if (opts.active) p.set("active", "true");
    return get<Challenge[]>(`/challenges?${p.toString()}`);
  },
  challenge: (slug: string) => get<Challenge>(`/challenges/${slug}`),
  badges: () => get<Badge[]>("/badges"),
  profile: (username: string) => get<UserProfile>(`/users/${username}`),

  admin: {
    moderationQueue: (status = "pending") =>
      get<ModerationItem[]>(`/admin/moderation?status=${status}`),
    decide: (id: string, decision: "approved" | "rejected" | "reset", reason?: string) =>
      send<ModerationItem>(`/admin/moderation/${id}`, "POST", { decision, reason }),
    analytics: () => get<AnalyticsSummary>("/admin/analytics"),
    auditLogs: (filters: { actor?: string; entity?: string; action?: string } = {}) => {
      const p = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v) as [string, string][],
      );
      return get<AuditLogEntry[]>(`/admin/audit-logs?${p.toString()}`);
    },
    users: (q?: string) =>
      get<AdminUser[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    destinations: () =>
      get<(Pick<Destination, "id" | "slug" | "name" | "district" | "stateCode" | "tier" | "status" | "basePoints" | "checkInCount" | "updatedAt"> & { completeness: number })[]>(
        "/admin/destinations",
      ),
    updateDestination: (slug: string, patch: Partial<Destination>) =>
      send<Destination>("/admin/destinations", "PATCH", { slug, patch }),
  },
};
