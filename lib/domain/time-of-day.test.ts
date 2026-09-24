import { describe, it, expect } from "vitest";
import { resolveTimeOfDay, DEFAULT_TIME_OF_DAY_CONFIG } from "./time-of-day";

describe("resolveTimeOfDay", () => {
  it("maps representative hours to their named bucket", () => {
    expect(resolveTimeOfDay(3).name).toBe("late-night");
    expect(resolveTimeOfDay(6).name).toBe("dawn");
    expect(resolveTimeOfDay(9).name).toBe("morning");
    expect(resolveTimeOfDay(13).name).toBe("midday");
    expect(resolveTimeOfDay(16).name).toBe("afternoon");
    expect(resolveTimeOfDay(18).name).toBe("evening");
    expect(resolveTimeOfDay(20).name).toBe("dusk");
    expect(resolveTimeOfDay(22).name).toBe("night");
  });

  it("folds hours before the first bucket into the wrapping night bucket", () => {
    // night = 21-2, so 0 and 1am belong to it too, not to late-night (which starts at 2).
    expect(resolveTimeOfDay(0).name).toBe("night");
    expect(resolveTimeOfDay(1.5).name).toBe("night");
  });

  it("treats bucket boundaries as inclusive of the start hour", () => {
    for (const [hour, name] of [
      [2, "late-night"],
      [5, "dawn"],
      [7, "morning"],
      [11, "midday"],
      [15, "afternoon"],
      [17, "evening"],
      [19, "dusk"],
      [21, "night"],
    ] as const) {
      expect(resolveTimeOfDay(hour).name).toBe(name);
    }
  });

  it("accepts fractional hours", () => {
    expect(resolveTimeOfDay(16.8).name).toBe("afternoon");
  });

  it("returns a usable gradient and the bucket's breathe duration", () => {
    const look = resolveTimeOfDay(13);
    expect(look.background).toMatch(/^linear-gradient\(135deg, #fdfdfd 0%.*#ecf0f2 100%\)$/);
    expect(look.breatheSeconds).toBe(18);
  });

  it("supports a custom config", () => {
    const custom = {
      angleDeg: 90,
      buckets: [{ name: "night" as const, from: 0, to: 24, breatheSeconds: 5, stops: ["#000000", "#111111"] }],
    };
    const look = resolveTimeOfDay(12, custom);
    expect(look.name).toBe("night");
    expect(look.background).toBe("linear-gradient(90deg, #000000 0%, #111111 100%)");
    expect(look.breatheSeconds).toBe(5);
  });

  it("every default bucket's `to` exceeds its `from`, and the set covers a full 24h day once wrapped", () => {
    const { buckets } = DEFAULT_TIME_OF_DAY_CONFIG;
    for (const b of buckets) expect(b.to).toBeGreaterThan(b.from);
    // 24 sample hours, each should resolve to exactly one bucket without throwing.
    for (let h = 0; h < 24; h++) {
      expect(() => resolveTimeOfDay(h)).not.toThrow();
    }
  });
});
