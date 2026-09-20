import { describe, expect, it } from "vitest";
import { LEVELS, TIER_POINTS, levelForPoints } from "../points";

/**
 * The points model is the one piece of frontend logic where being wrong
 * misleads a user about what a trip is worth, so it is tested directly.
 */
describe("tier points", () => {
  it("is inverted against popularity — the whole product thesis", () => {
    expect(TIER_POINTS[1]).toBeLessThan(TIER_POINTS[2]);
    expect(TIER_POINTS[2]).toBeLessThan(TIER_POINTS[3]);
    expect(TIER_POINTS[3]).toBeLessThan(TIER_POINTS[4]);
  });

  it("matches PRD Appendix A exactly", () => {
    expect(TIER_POINTS).toEqual({ 1: 10, 2: 30, 3: 75, 4: 150 });
  });

  it("makes one Tier-4 check-in worth fifteen Tier-1 check-ins", () => {
    expect(TIER_POINTS[4] / TIER_POINTS[1]).toBe(15);
  });
});

describe("levelForPoints", () => {
  it("starts everyone at Explorer", () => {
    const l = levelForPoints(0);
    expect(l.level).toBe(1);
    expect(l.name).toBe("Explorer");
  });

  it("sits on the boundary of the level it has just reached", () => {
    const l = levelForPoints(500);
    expect(l.level).toBe(2);
    expect(l.name).toBe("Wanderer");
    expect(l.progressPct).toBe(0);
  });

  it("stays on the lower level one point short of a threshold", () => {
    expect(levelForPoints(499).level).toBe(1);
    expect(levelForPoints(1_999).level).toBe(2);
    expect(levelForPoints(11_999).level).toBe(4);
  });

  it("unlocks Local Guide at level 5", () => {
    expect(levelForPoints(12_000).level).toBe(5);
    expect(levelForPoints(12_000).name).toBe("Voyager");
  });

  it("caps at Legend with no further progress", () => {
    const l = levelForPoints(1_000_000);
    expect(l.level).toBe(6);
    expect(l.name).toBe("Legend");
    expect(l.nextName).toBeNull();
    expect(l.pointsToNext).toBe(0);
    expect(l.progressPct).toBe(100);
  });

  it("reports progress toward the next level", () => {
    // Halfway between 2,000 (Pathfinder) and 5,000 (Trailblazer).
    const l = levelForPoints(3_500);
    expect(l.level).toBe(3);
    expect(l.pointsToNext).toBe(1_500);
    expect(l.progressPct).toBe(50);
  });

  it("never reports progress outside 0–100", () => {
    for (const p of [0, 1, 499, 500, 2_000, 11_999, 30_000, 99_999]) {
      const l = levelForPoints(p);
      expect(l.progressPct).toBeGreaterThanOrEqual(0);
      expect(l.progressPct).toBeLessThanOrEqual(100);
    }
  });

  it("has strictly increasing level thresholds", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].minPoints).toBeGreaterThan(LEVELS[i - 1].minPoints);
      expect(LEVELS[i].level).toBe(LEVELS[i - 1].level + 1);
    }
  });
});
