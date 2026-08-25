// One stroke of the flow field, on its own and blown up to fill a tile.
//
// The header draws a quiver of these: a quad that is wide at the tail and tapers
// toward the tip, so the shape itself says which way the air is moving. This is
// the same shape with the same proportions, at a size where a single one reads.

import { compass8Index } from "./wind-field";

export interface WindGlyphParams {
  /** tile edge, px */
  size: number;
  /** stroke length, px */
  len: number;
  /** half-width at the tail */
  weight: number;
  /** tip half-width as a fraction of the tail — the header uses 0.18 */
  tipRatio: number;
}

export const DEFAULT_WIND_GLYPH: WindGlyphParams = {
  size: 32,
  len: 23,
  weight: 4.2,
  tipRatio: 0.18,
};

export interface WindGlyph {
  /** the tapered quad: the two wide tail corners first, then the two tip corners */
  points: [number, number][];
  /** centre of the wide end */
  tail: [number, number];
  /** centre of the pointed end — where the air is heading */
  tip: [number, number];
}

/**
 * The glyph for a wind blowing *from* `dirDeg`, snapped to the nearest of the 8
 * major compass points. The tip points the way the air is going, matching the
 * header's strokes rather than the "from" bearing the number carries.
 */
export function windGlyph(dirDeg: number, params: Partial<WindGlyphParams> = {}): WindGlyph {
  const P = { ...DEFAULT_WIND_GLYPH, ...params };
  const snapped = compass8Index(dirDeg) * 45;

  // meteorological "from" → flow-to vector (x = east/right, y = south/down),
  // the same conversion makeFieldState does for the header
  const fr = (snapped * Math.PI) / 180;
  const hx = -Math.sin(fr);
  const hy = Math.cos(fr);

  const c = P.size / 2;
  const hl = P.len / 2;
  const wt = P.weight;
  const wh = wt * P.tipRatio;
  const tail: [number, number] = [c - hx * hl, c - hy * hl];
  const tip: [number, number] = [c + hx * hl, c + hy * hl];
  const nx = -hy;
  const ny = hx;

  return {
    points: [
      [tail[0] + nx * wt, tail[1] + ny * wt],
      [tail[0] - nx * wt, tail[1] - ny * wt],
      [tip[0] - nx * wh, tip[1] - ny * wh],
      [tip[0] + nx * wh, tip[1] + ny * wh],
    ],
    tail,
    tip,
  };
}

/** The glyph as an SVG path `d`. */
export function windGlyphPath(dirDeg: number, params: Partial<WindGlyphParams> = {}): string {
  const [p0, ...rest] = windGlyph(dirDeg, params).points;
  return `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)}${rest
    .map((p) => `L${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
    .join("")}Z`;
}
