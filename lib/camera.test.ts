import { describe, it, expect } from "vitest";
import { computeFitTransform, projectToScreen } from "./camera";

describe("computeFitTransform", () => {
  const vp = { width: 200, height: 100 };

  it("returns null for empty points or a zero-size viewport", () => {
    expect(computeFitTransform([], vp, 10)).toBeNull();
    expect(computeFitTransform([{ x: 0, y: 0 }], { width: 0, height: 100 }, 10)).toBeNull();
  });

  it("centers a symmetric bbox in the viewport", () => {
    // data x in [-10,10]; y flipped → also [-10,10]. Square data, wider viewport.
    const t = computeFitTransform(
      [{ x: -10, y: -10 }, { x: 10, y: 10 }],
      { width: 200, height: 100 },
      10
    )!;
    // limiting axis is height: (100 - 20) / 20 = 4
    expect(t.k).toBeCloseTo(4);
    // the bbox center (0,0 in flipped space) should map to the viewport center
    expect(t.x + 0 * t.k).toBeCloseTo(100); // viewport width / 2
    expect(t.y + 0 * t.k).toBeCloseTo(50); // viewport height / 2
  });

  it("guards degenerate (single point) without dividing by zero", () => {
    const t = computeFitTransform([{ x: 5, y: 5 }], vp, 10)!;
    expect(Number.isFinite(t.k)).toBe(true);
    expect(Number.isFinite(t.x)).toBe(true);
    expect(Number.isFinite(t.y)).toBe(true);
  });
});

describe("projectToScreen", () => {
  it("applies scale, translate, and the y-flip", () => {
    const { sx, sy } = projectToScreen({ x: 3, y: 4 }, { x: 100, y: 50, k: 2 });
    expect(sx).toBeCloseTo(3 * 2 + 100); // 106
    expect(sy).toBeCloseTo(-4 * 2 + 50); // 42  (north is up)
  });

  it("is the inverse-consistent partner of the fit transform's mapping", () => {
    const t = { x: 100, y: 50, k: 4 };
    const { sx, sy } = projectToScreen({ x: 0, y: 0 }, t);
    expect(sx).toBeCloseTo(t.x);
    expect(sy).toBeCloseTo(t.y);
  });
});
