import { describe, it, expect } from "vitest";
import {
  makeNoise,
  makeFbm,
  makeFieldState,
  advectionSpeed,
  lengthRampMultiplier,
  arrowAt,
  DEFAULT_FLOW_FIELD_PARAMS,
} from "./flow-field";
import type { WindField } from "./wind-field";

const P = DEFAULT_FLOW_FIELD_PARAMS;
const FIELD: WindField = {
  dirDeg: 90,
  meanSpeed: 9,
  gustFactor: 2.4,
  TI: 0.48,
  meanderDeg: 10,
};

describe("makeNoise / makeFbm", () => {
  it("is deterministic per seed and bounded", () => {
    const a = makeNoise(42);
    const b = makeNoise(42);
    expect(a(1.5, 2.5, 0.5)).toBe(b(1.5, 2.5, 0.5));
    for (let i = 0; i < 200; i++) {
      const v = a(i * 0.3, i * 0.7, i * 0.1);
      expect(v).toBeGreaterThanOrEqual(-1.2);
      expect(v).toBeLessThanOrEqual(1.2);
    }
    const fbm = makeFbm(a);
    expect(Math.abs(fbm(3.1, 1.2, 0.4))).toBeLessThanOrEqual(1.2);
  });

  it("different seeds differ", () => {
    expect(makeNoise(1)(0.3, 0.6, 0.9)).not.toBe(makeNoise(2)(0.3, 0.6, 0.9));
  });
});

describe("makeFieldState", () => {
  const slow = makeNoise(7);

  it("maps meteorological 'from' to a canvas flow-to vector", () => {
    // east wind (from 90°) blows west → Uhx≈-1, Uhy≈0
    const east = makeFieldState({ ...FIELD, dirDeg: 90, meanderDeg: 0 }, P, 0, 0, slow);
    expect(east.Uhx).toBeCloseTo(-1);
    expect(east.Uhy).toBeCloseTo(0);
    // north wind (from 0°) blows south (+y down) → Uhx≈0, Uhy≈1
    const north = makeFieldState({ ...FIELD, dirDeg: 0, meanderDeg: 0 }, P, 0, 0, slow);
    expect(north.Uhx).toBeCloseTo(0);
    expect(north.Uhy).toBeCloseTo(1);
  });

  it("freq derives from eddySize, pulse stays within [1, 1+pulseDepth], speedNorm in [0,1]", () => {
    const S = makeFieldState(FIELD, P, 3.3, 120, slow);
    expect(S.freq).toBeCloseTo(P.eddySize / 1000);
    expect(S.pulse).toBeGreaterThanOrEqual(1);
    expect(S.pulse).toBeLessThanOrEqual(1 + P.pulseDepth + 1e-9);
    expect(S.speedNorm).toBeGreaterThanOrEqual(0);
    expect(S.speedNorm).toBeLessThanOrEqual(1);
  });

  it("evolZ and advection sweep are zero at t=0 / advDist=0", () => {
    const S = makeFieldState(FIELD, P, 0, 0, slow);
    expect(S.evolZ).toBe(0);
    expect(S.sweepX).toBeCloseTo(0);
    expect(S.sweepY).toBeCloseTo(0);
  });
});

describe("advectionSpeed", () => {
  it("ranges from 40 (calm) to advectionMax (strong)", () => {
    expect(advectionSpeed(P, 0)).toBeCloseTo(40);
    expect(advectionSpeed(P, 1)).toBeCloseTo(P.advectionMax);
  });
});

describe("lengthRampMultiplier (the storm ramp)", () => {
  it("is 1 at/below calm and reaches the ramp factor at full speed, monotonically", () => {
    expect(lengthRampMultiplier(P, 0)).toBeCloseTo(1);
    expect(lengthRampMultiplier(P, 0.2)).toBeCloseTo(1);
    expect(lengthRampMultiplier(P, 1)).toBeCloseTo(P.lengthRampFactor);
    expect(lengthRampMultiplier(P, 0.6)).toBeGreaterThan(lengthRampMultiplier(P, 0.4));
  });
});

describe("arrowAt", () => {
  const noise = makeNoise(20260803);
  const fbm = makeFbm(noise);
  const slow = makeNoise(7);
  const S = makeFieldState(FIELD, P, 2.0, 60, slow);

  it("returns a normalized direction and coverage-based alpha", () => {
    const a = arrowAt(120, 40, 1, FIELD.TI, S, P, fbm); // inside a letter
    expect(Math.hypot(a.hx, a.hy)).toBeCloseTo(1, 5);
    expect(a.alpha).toBeCloseTo(0.92); // 0.12 + 0.8*1
    const out = arrowAt(120, 40, 0, FIELD.TI, S, P, fbm); // outside
    expect(out.alpha).toBeCloseTo(0.12);
  });

  it("high wind produces more length spread than calm (same field, differing speedNorm)", () => {
    const cells = Array.from({ length: 40 }, (_, i) => [17 + i * 13, 23 + i * 7] as const);
    const spread = (speedNorm: number) => {
      const St = { ...S, speedNorm };
      const lens = cells.map(([x, y]) => arrowAt(x, y, 1, FIELD.TI, St, P, fbm).lenScale);
      const mean = lens.reduce((s, v) => s + v, 0) / lens.length;
      return Math.sqrt(lens.reduce((s, v) => s + (v - mean) ** 2, 0) / lens.length);
    };
    expect(spread(1.0)).toBeGreaterThan(spread(0.15));
  });
});
