import { describe, expect, it } from "vitest";
import {
  countActiveFilters,
  hasActiveFilters,
  parseDestinationQuery,
  serializeDestinationQuery,
} from "../api/params";
import type { DestinationQuery } from "../types";

/**
 * Filters live in the URL, so serialise/parse has to round-trip exactly or a
 * shared link shows different results from the page that produced it.
 */
describe("destination query round-trip", () => {
  it("round-trips a full query", () => {
    const query: DestinationQuery = {
      state: "MP",
      district: "Morena",
      categories: ["historical", "offbeat"],
      duration: "half_day",
      difficulty: ["easy", "moderate"],
      tier: [3, 4],
      season: "monsoon",
      accessible: true,
      near: { lat: 26.1494, lng: 78.1967 },
      radius: 50,
      q: "yogini",
      sort: "points",
      page: 2,
    };

    const parsed = parseDestinationQuery(serializeDestinationQuery(query));

    expect(parsed.state).toBe("MP");
    expect(parsed.district).toBe("Morena");
    expect(parsed.categories).toEqual(["historical", "offbeat"]);
    expect(parsed.duration).toBe("half_day");
    expect(parsed.difficulty).toEqual(["easy", "moderate"]);
    expect(parsed.tier).toEqual([3, 4]);
    expect(parsed.season).toBe("monsoon");
    expect(parsed.accessible).toBe(true);
    expect(parsed.near).toEqual({ lat: 26.1494, lng: 78.1967 });
    expect(parsed.radius).toBe(50);
    expect(parsed.q).toBe("yogini");
    expect(parsed.sort).toBe("points");
    expect(parsed.page).toBe(2);
  });

  it("omits defaults so a clean URL stays clean", () => {
    const qs = serializeDestinationQuery({ sort: "recommended", page: 1 }).toString();
    expect(qs).toBe("");
  });

  it("drops junk rather than passing it through to the API", () => {
    const parsed = parseDestinationQuery(
      new URLSearchParams("tier=9,3,banana&difficulty=impossible,easy&season=eclipse"),
    );
    expect(parsed.tier).toEqual([3]);
    expect(parsed.difficulty).toEqual(["easy"]);
    expect(parsed.season).toBeUndefined();
  });

  it("ignores a malformed near= without throwing", () => {
    expect(parseDestinationQuery(new URLSearchParams("near=abc")).near).toBeUndefined();
    expect(parseDestinationQuery(new URLSearchParams("near=24.85")).near).toBeUndefined();
  });

  it("reads Next's searchParams object shape as well as URLSearchParams", () => {
    const parsed = parseDestinationQuery({ tier: "4", categories: "offbeat" });
    expect(parsed.tier).toEqual([4]);
    expect(parsed.categories).toEqual(["offbeat"]);
  });
});

describe("active filter helpers", () => {
  it("does not count state or sort as user-applied filters", () => {
    expect(hasActiveFilters({ state: "MP", sort: "points", page: 3 })).toBe(false);
    expect(countActiveFilters({ state: "MP", sort: "points" })).toBe(0);
  });

  it("counts each selected value individually", () => {
    expect(
      countActiveFilters({
        categories: ["historical", "offbeat"],
        tier: [3, 4],
        duration: "2h",
        accessible: true,
      }),
    ).toBe(6);
  });
});
