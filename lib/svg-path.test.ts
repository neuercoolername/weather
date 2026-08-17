import { describe, it, expect } from "vitest";
import { toSvgPolyline } from "./svg-path";

describe("toSvgPolyline", () => {
  it("draws nothing for fewer than two points", () => {
    expect(toSvgPolyline([])).toBe("");
    expect(toSvgPolyline([{ x: 1, y: 2 }])).toBe("");
  });

  it("moves to the first point and lines to the rest", () => {
    expect(toSvgPolyline([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 6, y: 0 }])).toBe(
      "M 0,0 L 3,0 L 6,0"
    );
  });

  it("flips y, so north renders upward", () => {
    // +y = north in data space; SVG's y grows downward, so it must come out negative.
    expect(toSvgPolyline([{ x: 0, y: 5 }, { x: 0, y: -5 }])).toBe("M 0,-5 L 0,5");
  });
});
