import { describe, expect, it } from "vitest";
import {
  completeness,
  getDestination,
  listAllDestinations,
  nearbyDestinations,
  queryDestinations,
  search,
} from "@/mocks/db";
import { TIER_POINTS } from "../points";

describe("catalogue integrity", () => {
  const all = listAllDestinations();

  it("has 29 destinations, weighted toward the long tail", () => {
    expect(all).toHaveLength(29);
    const tier34 = all.filter((d) => d.tier >= 3);
    expect(tier34.length).toBeGreaterThan(all.length / 2);
  });

  it("assigns base points strictly from tier, never by hand", () => {
    for (const d of all) {
      expect(d.basePoints).toBe(TIER_POINTS[d.tier]);
    }
  });

  it("has unique slugs", () => {
    expect(new Set(all.map((d) => d.slug)).size).toBe(all.length);
  });

  it("has every listing at 100% completeness — no placeholder sections", () => {
    for (const d of all) {
      expect(completeness(d)).toBe(100);
    }
  });

  it("puts every destination inside plausible Madhya Pradesh bounds", () => {
    for (const d of all) {
      expect(d.location.lat).toBeGreaterThan(21);
      expect(d.location.lat).toBeLessThan(27);
      expect(d.location.lng).toBeGreaterThan(74);
      expect(d.location.lng).toBeLessThan(83);
    }
  });
});

describe("queryDestinations", () => {
  it("defaults to a recommended sort that leads with the long tail", () => {
    const { items } = queryDestinations({ pageSize: 5 });
    expect(items[0].tier).toBe(4);
  });

  it("filters by tier", () => {
    const { items, total } = queryDestinations({ tier: [4], pageSize: 60 });
    expect(total).toBe(8);
    expect(items.every((d) => d.tier === 4)).toBe(true);
  });

  it("treats multiple categories as OR, not AND", () => {
    const wildlife = queryDestinations({ categories: ["wildlife"], pageSize: 60 }).total;
    const both = queryDestinations({
      categories: ["wildlife", "waterfalls"],
      pageSize: 60,
    }).total;
    expect(both).toBeGreaterThan(wildlife);
  });

  it("matches duration against the minimum viable visit", () => {
    const { items } = queryDestinations({ duration: "2h", pageSize: 60 });
    expect(items.every((d) => d.minDurationMin <= 120)).toBe(true);
  });

  it("paginates without dropping or duplicating rows", () => {
    const p1 = queryDestinations({ pageSize: 10, page: 1 });
    const p2 = queryDestinations({ pageSize: 10, page: 2 });
    const p3 = queryDestinations({ pageSize: 10, page: 3 });
    const slugs = [...p1.items, ...p2.items, ...p3.items].map((d) => d.slug);
    expect(slugs).toHaveLength(29);
    expect(new Set(slugs).size).toBe(29);
    expect(p1.totalPages).toBe(3);
  });

  it("returns distances and respects the radius on a near= query", () => {
    const { items } = queryDestinations({
      near: { lat: 23.2599, lng: 77.4126 }, // Bhopal
      radius: 60,
      sort: "distance",
      pageSize: 60,
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((d) => (d.distanceKm ?? 0) <= 60)).toBe(true);
    for (let i = 1; i < items.length; i++) {
      expect(items[i].distanceKm!).toBeGreaterThanOrEqual(items[i - 1].distanceKm!);
    }
  });

  it("never leaks detail fields into a summary projection", () => {
    const [first] = queryDestinations({ pageSize: 1 }).items;
    expect(first).not.toHaveProperty("story");
    expect(first).not.toHaveProperty("itinerary");
    expect(first).not.toHaveProperty("info");
  });
});

describe("nearbyDestinations", () => {
  it("surfaces higher-tier neighbours first — this is the redistribution engine", () => {
    const nearby = nearbyDestinations("gwalior-fort", 100);
    expect(nearby.length).toBeGreaterThan(0);
    for (let i = 1; i < nearby.length; i++) {
      expect(nearby[i].tier).toBeLessThanOrEqual(nearby[i - 1].tier);
    }
    expect(nearby[0].tier).toBe(4);
  });

  it("never includes the origin destination", () => {
    expect(nearbyDestinations("orchha", 200).some((d) => d.slug === "orchha")).toBe(false);
  });

  it("respects the radius", () => {
    const close = nearbyDestinations("khajuraho-monuments", 25);
    const far = nearbyDestinations("khajuraho-monuments", 200);
    expect(far.length).toBeGreaterThanOrEqual(close.length);
    expect(close.every((d) => (d.distanceKm ?? 0) <= 25)).toBe(true);
  });
});

describe("search", () => {
  it("finds an exact name", () => {
    expect(search("Orchha")[0].slug).toBe("orchha");
  });

  it("resolves regional spelling variants", () => {
    expect(search("Khajurao")[0].slug).toBe("khajuraho-monuments");
    expect(search("Mandav")[0].slug).toBe("mandu");
    expect(search("Bhojeshwar")[0].slug).toBe("bhojpur-temple");
  });

  it("tolerates a typo", () => {
    expect(search("Sanchii")[0].slug).toBe("sanchi-stupa");
  });

  it("matches on district", () => {
    const hits = search("Morena");
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.every((d) => d.district === "Morena")).toBe(true);
  });

  it("returns nothing for an empty term rather than everything", () => {
    expect(search("")).toEqual([]);
    expect(search("   ")).toEqual([]);
  });
});

describe("getDestination", () => {
  it("returns undefined for an unknown slug instead of throwing", () => {
    expect(getDestination("not-a-real-place")).toBeUndefined();
  });
});
