import { describe, it, expect } from "vitest";
import {
  DEFAULT_RING_SHAPE_PARAMS,
  handDrawnRingPath,
  pickRingStyle,
  ringPath,
  ringPoints,
  type RingStyle,
} from "./mark-shape";

const P = DEFAULT_RING_SHAPE_PARAMS;

// mulberry32: a small seeded generator, so a "random" ring is repeatable in a test.
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STYLES: RingStyle[] = ["overshoot", "gap", "closed", "multi"];
const SEEDS = Array.from({ length: 50 }, (_, i) => i * 7919 + 1);

// Total angle the pen turns through, summed sample to sample.
function sweptAngle(points: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a0 = Math.atan2(points[i - 1][1], points[i - 1][0]);
    const a1 = Math.atan2(points[i][1], points[i][0]);
    let d = a1 - a0;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    total += d;
  }
  return Math.abs(total);
}

describe("pickRingStyle", () => {
  it("never picks a style whose weight is zero", () => {
    const weights = { overshoot: 1, gap: 0, closed: 0, multi: 1 };
    for (let u = 0; u < 1; u += 0.01) {
      expect(["overshoot", "multi"]).toContain(pickRingStyle(u, weights));
    }
  });

  it("splits the unit interval in proportion to the weights", () => {
    const weights = { overshoot: 1, gap: 1, closed: 0, multi: 2 };
    expect(pickRingStyle(0.1, weights)).toBe("overshoot");
    expect(pickRingStyle(0.3, weights)).toBe("gap");
    expect(pickRingStyle(0.6, weights)).toBe("multi");
  });

  it("falls back to a closed ring when every weight is zero", () => {
    expect(pickRingStyle(0.5, { overshoot: 0, gap: 0, closed: 0, multi: 0 })).toBe("closed");
  });
});

describe("ringPoints", () => {
  it("is repeatable for the same random sequence", () => {
    const a = handDrawnRingPath(seeded(42), P);
    const b = handDrawnRingPath(seeded(42), P);
    expect(a).toBe(b);
    expect(handDrawnRingPath(seeded(43), P)).not.toBe(a);
  });

  it("stays close to the unit circle", () => {
    for (const style of STYLES) {
      for (const seed of SEEDS) {
        for (const [x, y] of ringPoints(seeded(seed), style, P).points) {
          const r = Math.hypot(x, y);
          expect(r).toBeGreaterThan(0.6);
          expect(r).toBeLessThan(1.4);
        }
      }
    }
  });

  it("travels the angle its style promises", () => {
    for (const seed of SEEDS) {
      const deg = (style: RingStyle) => (sweptAngle(ringPoints(seeded(seed), style, P).points) * 180) / Math.PI;
      // Centre drift shifts the measured angle a little, hence the slack.
      expect(deg("overshoot")).toBeGreaterThan(360 + P.overshootDeg[0] - 8);
      expect(deg("overshoot")).toBeLessThan(360 + P.overshootDeg[1] + 8);
      expect(deg("gap")).toBeGreaterThan(360 - P.gapDeg[1] - 8);
      expect(deg("gap")).toBeLessThan(360 - P.gapDeg[0] + 8);
      expect(deg("multi")).toBeGreaterThan(360 * P.passes[0] - 8);
      expect(deg("multi")).toBeLessThan(360 * P.passes[1] + 8);
    }
  });

  it("closes only the closed style", () => {
    for (const style of STYLES) {
      const d = ringPath(ringPoints(seeded(7), style, P));
      expect(d.endsWith("Z")).toBe(style === "closed");
    }
  });

  it("draws a perfect circle with every irregularity turned off", () => {
    const flat = {
      ...P,
      roughness: 0,
      ellipse: 0,
      drift: 0,
      passDrift: 0,
      wander: 0,
      centerDrift: 0,
      leadIn: 0,
      flick: 0,
    };
    for (const style of STYLES) {
      for (const [x, y] of ringPoints(seeded(3), style, flat).points) {
        expect(Math.hypot(x, y)).toBeCloseTo(1, 9);
      }
    }
  });
});
