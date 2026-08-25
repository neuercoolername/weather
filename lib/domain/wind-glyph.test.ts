import { describe, it, expect } from "vitest";
import { windGlyph, windGlyphPath, DEFAULT_WIND_GLYPH } from "./wind-glyph";

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

describe("windGlyph", () => {
  it("points the tip the way the air is going, not where it came from", () => {
    // wind from the north blows south: tip below the tail (+y is down)
    const n = windGlyph(0);
    expect(n.tip[1]).toBeGreaterThan(n.tail[1]);
    expect(near(n.tip[0], n.tail[0])).toBe(true);

    // wind from the west blows east: tip to the right
    const w = windGlyph(270);
    expect(w.tip[0]).toBeGreaterThan(w.tail[0]);
    expect(near(w.tip[1], w.tail[1])).toBe(true);
  });

  it("mirrors opposite winds", () => {
    const n = windGlyph(0);
    const s = windGlyph(180);
    expect(n.tip[1]).toBeCloseTo(s.tail[1]);
    expect(n.tail[1]).toBeCloseTo(s.tip[1]);
  });

  it("snaps to the nearest of the 8 points", () => {
    expect(windGlyph(20).tip).toEqual(windGlyph(0).tip); // 20° rounds to N
    expect(windGlyph(30).tip).toEqual(windGlyph(45).tip); // 30° rounds to NE
  });

  it("stays centred in the tile and inside it", () => {
    const c = DEFAULT_WIND_GLYPH.size / 2;
    for (let i = 0; i < 8; i++) {
      const g = windGlyph(i * 45);
      expect((g.tip[0] + g.tail[0]) / 2).toBeCloseTo(c);
      expect((g.tip[1] + g.tail[1]) / 2).toBeCloseTo(c);
      for (const [x, y] of g.points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(DEFAULT_WIND_GLYPH.size);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(DEFAULT_WIND_GLYPH.size);
      }
    }
  });

  it("tapers: the tail end is wider than the tip end", () => {
    const g = windGlyph(0);
    const tailW = Math.hypot(g.points[0][0] - g.points[1][0], g.points[0][1] - g.points[1][1]);
    const tipW = Math.hypot(g.points[2][0] - g.points[3][0], g.points[2][1] - g.points[3][1]);
    expect(tipW).toBeLessThan(tailW);
    expect(tipW / tailW).toBeCloseTo(DEFAULT_WIND_GLYPH.tipRatio);
  });

  it("renders a closed 4-point path", () => {
    const d = windGlyphPath(0);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d.match(/L/g)).toHaveLength(3);
  });
});
