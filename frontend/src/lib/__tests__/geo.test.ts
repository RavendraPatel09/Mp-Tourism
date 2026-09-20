import { describe, expect, it } from "vitest";
import { bounds, circlePolygon, haversineKm, isWithinGeofence } from "../geo";

const KHAJURAHO = { lat: 24.8524, lng: 79.9199 };
const BHIMKUND = { lat: 24.6833, lng: 79.6 };

describe("haversineKm", () => {
  it("is zero for a point against itself", () => {
    expect(haversineKm(KHAJURAHO, KHAJURAHO)).toBe(0);
  });

  it("matches the published road-adjacent distance within tolerance", () => {
    // Straight-line Khajuraho → Bhimkund is around 34 km (77 km by road).
    expect(haversineKm(KHAJURAHO, BHIMKUND)).toBeGreaterThan(30);
    expect(haversineKm(KHAJURAHO, BHIMKUND)).toBeLessThan(40);
  });

  it("is symmetric", () => {
    expect(haversineKm(KHAJURAHO, BHIMKUND)).toBeCloseTo(
      haversineKm(BHIMKUND, KHAJURAHO),
      9,
    );
  });
});

describe("isWithinGeofence", () => {
  const centre = KHAJURAHO;
  // Roughly 500 m north of the centre.
  const nearby = { lat: centre.lat + 0.0045, lng: centre.lng };

  it("accepts a point well inside the fence", () => {
    expect(isWithinGeofence(nearby, centre, 800)).toBe(true);
  });

  it("rejects a point outside the fence when accuracy is perfect", () => {
    expect(isWithinGeofence(nearby, centre, 300, 0)).toBe(false);
  });

  it("accepts a point just outside once GPS accuracy is allowed for", () => {
    // This is the rule Member B implements server-side: accept if the
    // accuracy circle intersects the fence, rather than demanding a strict
    // point-in-circle, because GPS under tree cover is routinely ±50 m.
    expect(isWithinGeofence(nearby, centre, 450, 0)).toBe(false);
    expect(isWithinGeofence(nearby, centre, 450, 100)).toBe(true);
  });

  it("rejects a check-in from a different district entirely", () => {
    expect(isWithinGeofence(BHIMKUND, centre, 5000, 100)).toBe(false);
  });
});

describe("circlePolygon", () => {
  it("returns a closed ring", () => {
    const ring = circlePolygon(KHAJURAHO, 500, 32);
    expect(ring).toHaveLength(33);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("puts every vertex at approximately the requested radius", () => {
    const radiusM = 800;
    for (const [lng, lat] of circlePolygon(KHAJURAHO, radiusM, 16)) {
      const d = haversineKm({ lat, lng }, KHAJURAHO) * 1000;
      expect(Math.abs(d - radiusM)).toBeLessThan(radiusM * 0.02);
    }
  });
});

describe("bounds", () => {
  it("returns west, south, east, north", () => {
    const [w, s, e, n] = bounds([KHAJURAHO, BHIMKUND]);
    expect(w).toBeLessThan(e);
    expect(s).toBeLessThan(n);
    expect(w).toBe(BHIMKUND.lng);
    expect(n).toBe(KHAJURAHO.lat);
  });
});
