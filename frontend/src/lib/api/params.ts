import type { DestinationQuery, Difficulty, Season, Tier } from "@/lib/types";

/**
 * Query-string serialisation for GET /v1/destinations, shared by the client,
 * the route handler and the URL state on /explore. One implementation, so a
 * shareable filtered URL and an API call can never drift apart.
 */

const DIFFICULTIES: Difficulty[] = ["easy", "moderate", "challenging", "strenuous"];
const SEASONS: Season[] = ["winter", "summer", "monsoon", "post_monsoon", "year_round"];

export function serializeDestinationQuery(q: DestinationQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.state) p.set("state", q.state);
  if (q.district) p.set("district", q.district);
  if (q.categories?.length) p.set("categories", q.categories.join(","));
  if (q.duration) p.set("duration", q.duration);
  if (q.difficulty?.length) p.set("difficulty", q.difficulty.join(","));
  if (q.tier?.length) p.set("tier", q.tier.join(","));
  if (q.season) p.set("season", q.season);
  if (q.accessible) p.set("accessible", "true");
  if (q.near) p.set("near", `${q.near.lat},${q.near.lng}`);
  if (q.radius) p.set("radius", String(q.radius));
  if (q.q) p.set("q", q.q);
  if (q.sort && q.sort !== "recommended") p.set("sort", q.sort);
  if (q.page && q.page > 1) p.set("page", String(q.page));
  if (q.pageSize) p.set("pageSize", String(q.pageSize));
  return p;
}

export function parseDestinationQuery(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
): DestinationQuery {
  const get = (k: string): string | undefined => {
    if (sp instanceof URLSearchParams) return sp.get(k) ?? undefined;
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const list = (k: string) =>
    get(k)
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  const near = get("near")?.split(",").map(Number);
  const duration = get("duration");
  const sort = get("sort");

  return {
    state: get("state"),
    district: get("district"),
    categories: list("categories"),
    duration:
      duration === "2h" || duration === "half_day" || duration === "full_day" || duration === "multi_day"
        ? duration
        : undefined,
    difficulty: list("difficulty").filter((d): d is Difficulty =>
      DIFFICULTIES.includes(d as Difficulty),
    ),
    tier: list("tier")
      .map(Number)
      .filter((n): n is Tier => n === 1 || n === 2 || n === 3 || n === 4),
    season: SEASONS.includes(get("season") as Season) ? (get("season") as Season) : undefined,
    accessible: get("accessible") === "true",
    near: near && near.length === 2 && near.every(Number.isFinite)
      ? { lat: near[0], lng: near[1] }
      : undefined,
    radius: get("radius") ? Number(get("radius")) : undefined,
    q: get("q"),
    sort:
      sort === "points" || sort === "rating" || sort === "distance" || sort === "duration"
        ? sort
        : "recommended",
    page: get("page") ? Math.max(1, Number(get("page"))) : 1,
    pageSize: get("pageSize") ? Number(get("pageSize")) : undefined,
  };
}

/** True when any discovery filter is applied — drives the "clear all" affordance. */
export function hasActiveFilters(q: DestinationQuery) {
  return Boolean(
    q.district ||
      q.categories?.length ||
      q.duration ||
      q.difficulty?.length ||
      q.tier?.length ||
      q.season ||
      q.accessible ||
      q.near ||
      q.q,
  );
}

export function countActiveFilters(q: DestinationQuery) {
  return (
    (q.district ? 1 : 0) +
    (q.categories?.length ?? 0) +
    (q.duration ? 1 : 0) +
    (q.difficulty?.length ?? 0) +
    (q.tier?.length ?? 0) +
    (q.season ? 1 : 0) +
    (q.accessible ? 1 : 0) +
    (q.near ? 1 : 0)
  );
}
