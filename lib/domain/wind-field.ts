// Derive the compact wind-field parameters that drive the flow-field headline
// from a series of hourly readings. Pure — safe to run server-side and test.

export interface WindReading {
  /** wind speed, km/h (mean) */
  spd: number;
  /** wind gust, km/h (peak) */
  gust: number;
  /** wind direction, degrees (meteorological "from") */
  dir: number;
}

export interface WindField {
  /** mean "from" direction, degrees */
  dirDeg: number;
  /** mean wind speed, km/h */
  meanSpeed: number;
  /** gust factor = mean(gust) / mean(speed) */
  gustFactor: number;
  /** turbulence intensity ≈ std/mean, derived from the gust factor */
  TI: number;
  /** amplitude of the slow direction meander, degrees (from 24h circular variance) */
  meanderDeg: number;
}

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const D2R = Math.PI / 180;

/**
 * Index of the nearest of the 8 major compass points, clockwise from N —
 * 0 = N, 1 = NE, 2 = E, and so on. Multiply by 45 for the snapped bearing.
 */
export function compass8Index(deg: number): number {
  const norm = ((deg % 360) + 360) % 360;
  return Math.round(norm / 45) % 8;
}

/**
 * Compute the flow-field parameters from a window of hourly readings.
 * Returns null when there's no usable data.
 */
export function computeWindField(series: WindReading[]): WindField | null {
  const rows = series.filter(
    (r) =>
      Number.isFinite(r.spd) &&
      Number.isFinite(r.gust) &&
      Number.isFinite(r.dir) &&
      r.spd > 0
  );
  if (rows.length === 0) return null;

  const n = rows.length;
  const meanSpeed = rows.reduce((s, r) => s + r.spd, 0) / n;
  const meanGust = rows.reduce((s, r) => s + r.gust, 0) / n;
  const gustFactor = meanGust / meanSpeed;
  // turbulence intensity from gust factor via a ~3σ peak factor: G ≈ 1 + 3·TI
  const TI = (clamp(gustFactor, 1.1, 3.0) - 1) / 3;

  // circular mean + variance of direction
  let sumSin = 0;
  let sumCos = 0;
  for (const r of rows) {
    sumSin += Math.sin(r.dir * D2R);
    sumCos += Math.cos(r.dir * D2R);
  }
  const dirDeg = ((Math.atan2(sumSin, sumCos) / D2R) % 360 + 360) % 360;
  const R = Math.hypot(sumSin, sumCos) / n; // resultant length, 0..1
  // angular standard deviation → meander amplitude, capped
  const angStdDeg = Math.sqrt(-2 * Math.log(Math.max(R, 1e-6))) / D2R;
  const meanderDeg = clamp(angStdDeg, 0, 38);

  return { dirDeg, meanSpeed, gustFactor, TI, meanderDeg };
}
