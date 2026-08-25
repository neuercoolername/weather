import { describe, it, expect } from "vitest";
import { compass8Index, computeWindField, type WindReading } from "./wind-field";

describe("computeWindField", () => {
  it("returns null for empty or unusable input", () => {
    expect(computeWindField([])).toBeNull();
    expect(computeWindField([{ spd: 0, gust: 0, dir: 90 }])).toBeNull(); // spd must be > 0
    expect(
      computeWindField([{ spd: NaN, gust: 10, dir: 90 }])
    ).toBeNull();
  });

  it("computes mean speed and gust factor", () => {
    const s: WindReading[] = [
      { spd: 8, gust: 20, dir: 90 },
      { spd: 12, gust: 28, dir: 90 },
    ];
    const f = computeWindField(s)!;
    expect(f.meanSpeed).toBeCloseTo(10);
    expect(f.gustFactor).toBeCloseTo(24 / 10); // mean gust / mean speed
  });

  it("derives TI from the gust factor as (G-1)/3, clamped", () => {
    // G = 2.0 → TI = 1/3
    const f = computeWindField([{ spd: 10, gust: 20, dir: 90 }])!;
    expect(f.gustFactor).toBeCloseTo(2);
    expect(f.TI).toBeCloseTo(1 / 3);
    // very gusty clamps at G=3 → TI = 2/3
    const g = computeWindField([{ spd: 10, gust: 90, dir: 90 }])!;
    expect(g.TI).toBeCloseTo(2 / 3);
    // barely gusty clamps at G=1.1 → TI ≈ 0.033
    const h = computeWindField([{ spd: 10, gust: 10, dir: 90 }])!;
    expect(h.TI).toBeCloseTo(0.1 / 3);
  });

  it("computes the circular mean direction (wraps across 360°)", () => {
    // 350° and 10° should average to ~0°, not 180°
    const f = computeWindField([
      { spd: 10, gust: 15, dir: 350 },
      { spd: 10, gust: 15, dir: 10 },
    ])!;
    expect(Math.min(f.dirDeg, 360 - f.dirDeg)).toBeLessThan(1);
  });

  it("meander is ~0 for a steady direction and grows with spread", () => {
    const steady = computeWindField(
      Array.from({ length: 6 }, () => ({ spd: 10, gust: 15, dir: 90 }))
    )!;
    expect(steady.meanderDeg).toBeLessThan(1);

    const spread = computeWindField([
      { spd: 10, gust: 15, dir: 60 },
      { spd: 10, gust: 15, dir: 90 },
      { spd: 10, gust: 15, dir: 120 },
    ])!;
    expect(spread.meanderDeg).toBeGreaterThan(steady.meanderDeg);
    expect(spread.meanderDeg).toBeLessThanOrEqual(38); // capped
  });
});

describe("compass8Index", () => {
  it("indexes each of the 8 points at its exact bearing", () => {
    // 0 = N, 1 = NE, 2 = E, 3 = SE, 4 = S, 5 = SW, 6 = W, 7 = NW
    expect([0, 45, 90, 135, 180, 225, 270, 315].map(compass8Index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it("snaps to the nearest point, rounding the half-sector up", () => {
    expect(compass8Index(22.5)).toBe(1); // NE
    expect(compass8Index(22.4)).toBe(0); // N
    expect(compass8Index(44)).toBe(1);
    expect(compass8Index(337.5)).toBe(0); // wraps past 360 back to N
    expect(compass8Index(359)).toBe(0);
  });

  it("wraps bearings outside 0..360", () => {
    expect(compass8Index(-45)).toBe(7); // NW
    expect(compass8Index(450)).toBe(2); // E
    expect(compass8Index(-360)).toBe(0);
  });
});
