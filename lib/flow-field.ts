// Parameterised wind flow-field engine (pure / no DOM).
//
// A synthetic turbulence field whose *statistics* match a real wind reading:
// mean flow from direction + speed, turbulence intensity from the gust factor,
// a slow direction meander, and a gust "pulse". Rendered elsewhere as a quiver
// of tapered strokes gated by a text mask. See docs/features/flow-field-headline.

import type { WindField } from "./wind-field";

// ---- tunable "feel" parameters (mirror the prototype's tuning panel) ----
export interface FlowFieldParams {
  /** field morph / shake speed */
  churn: number;
  /** spatial scale — larger = finer eddies (freq = eddySize/1000) */
  eddySize: number;
  /** in-letter turbulence floor: how much the letter arrows swing vs stay coherent */
  letterJitter: number;
  /** max downwind sweep, px/s */
  advectionMax: number;
  /** gust "breathing" depth */
  pulseDepth: number;
  /** gust pulse period, seconds */
  pulsePeriodSec: number;
  /** medium-wind length-variance baseline */
  lengthVariance: number;
  /** length ramp: effective variance = lengthVariance · lerp(1, factor, speedNorm) */
  lengthRampFactor: number;
  /** cross/along fluctuation ratio (anisotropy) */
  anisotropy: number;
}

export const DEFAULT_FLOW_FIELD_PARAMS: FlowFieldParams = {
  churn: 2.5,
  eddySize: 30,
  letterJitter: 0.78,
  advectionMax: 230,
  pulseDepth: 0.6,
  pulsePeriodSec: 7.4,
  lengthVariance: 0.62,
  lengthRampFactor: 3.0,
  anisotropy: 0.7,
};

/** A calm default field for when there's no wind reading available. */
export const CALM_WIND_FIELD: WindField = {
  dirDeg: 90,
  meanSpeed: 6,
  gustFactor: 1.4,
  TI: 0.13,
  meanderDeg: 6,
};

// ---- small math helpers ----
export const clamp = (x: number, a: number, b: number): number =>
  x < a ? a : x > b ? b : x;
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const D2R = Math.PI / 180;

// ---- seeded improved-Perlin 3D + fBm ----
export type Noise3 = (x: number, y: number, z: number) => number;

export function makeNoise(seed: number): Noise3 {
  const p = new Uint8Array(512);
  const src = new Uint8Array(256);
  for (let i = 0; i < 256; i++) src[i] = i;
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 255; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    const t = src[i];
    src[i] = src[j];
    src[j] = t;
  }
  for (let i = 0; i < 512; i++) p[i] = src[i & 255];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lp = (a: number, b: number, t: number) => a + t * (b - a);
  const grad = (h: number, x: number, y: number, z: number) => {
    const g = h & 15;
    const u = g < 8 ? x : y;
    const v = g < 4 ? y : g === 12 || g === 14 ? x : z;
    return ((g & 1) === 0 ? u : -u) + ((g & 2) === 0 ? v : -v);
  };
  return (x, y, z) => {
    const X = Math.floor(x) & 255,
      Y = Math.floor(y) & 255,
      Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x),
      v = fade(y),
      w = fade(z);
    const A = p[X] + Y,
      AA = p[A] + Z,
      AB = p[A + 1] + Z,
      B = p[X + 1] + Y,
      BA = p[B] + Z,
      BB = p[B + 1] + Z;
    return lp(
      lp(
        lp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u),
        lp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u),
        v
      ),
      lp(
        lp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u),
        lp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u),
        v
      ),
      w
    );
  };
}

/** fBm tuned to a ~-5/3 spectrum: lacunarity 2, gain 0.8, 3 octaves. */
export function makeFbm(noise: Noise3): Noise3 {
  return (x, y, z) => {
    let a = 0,
      amp = 1,
      f = 1,
      norm = 0;
    for (let o = 0; o < 3; o++) {
      a += amp * noise(x * f, y * f, z * f);
      norm += amp;
      amp *= 0.8;
      f *= 2;
    }
    return a / norm;
  };
}

// ---- per-frame field state ----
export interface FieldState {
  Uhx: number;
  Uhy: number;
  freq: number;
  evolZ: number;
  sweepX: number;
  sweepY: number;
  pulse: number;
  /** 0..1 normalized wind speed (drives advection tempo + length ramp) */
  speedNorm: number;
}

/**
 * Compute the time-varying field state.
 * @param tSec   elapsed seconds
 * @param advDist accumulated advection distance in px (caller integrates it)
 * @param slowNoise a second seeded noise used for the slow direction meander
 */
export function makeFieldState(
  field: WindField,
  params: FlowFieldParams,
  tSec: number,
  advDist: number,
  slowNoise: Noise3
): FieldState {
  const speedNorm = smoothstep(0, 30, clamp(field.meanSpeed, 0, 30));
  const meanderRad = field.meanderDeg * D2R * slowNoise(tSec * 0.05, 0, 111);
  const fromDeg = field.dirDeg + meanderRad / D2R;
  const fr = fromDeg * D2R;
  // meteorological "from" → canvas flow-to vector (x = east/right, y = south/down)
  const Uhx = -Math.sin(fr);
  const Uhy = Math.cos(fr);
  const freq = params.eddySize / 1000;
  const ramp = (p: number) => {
    p = p - Math.floor(p);
    return p < 0.72 ? (p / 0.72) * 0.6 : 0.6 + (1 - (p - 0.72) / 0.28) * 0.4;
  };
  const pulse = 1 + params.pulseDepth * ramp(tSec / params.pulsePeriodSec);
  return {
    Uhx,
    Uhy,
    freq,
    evolZ: tSec * params.churn,
    sweepX: Uhx * advDist * freq,
    sweepY: Uhy * advDist * freq,
    pulse,
    speedNorm,
  };
}

/** Advection speed (px/s) for the current state. */
export function advectionSpeed(params: FlowFieldParams, speedNorm: number): number {
  return lerp(40, params.advectionMax, speedNorm);
}

/** Divergence-free fluctuation (curl of an fBm potential), anisotropic along U. */
export function curl(
  px: number,
  py: number,
  S: FieldState,
  params: FlowFieldParams,
  fbm: Noise3
): [number, number] {
  const nx = px * S.freq - S.sweepX;
  const ny = py * S.freq - S.sweepY;
  const e = 0.75;
  const dpx = (fbm(nx + e, ny, S.evolZ) - fbm(nx - e, ny, S.evolZ)) / (2 * e);
  const dpy = (fbm(nx, ny + e, S.evolZ) - fbm(nx, ny - e, S.evolZ)) / (2 * e);
  let cx = dpy,
    cy = -dpx; // curl
  // anisotropy: fluctuate more along the mean flow than across it
  const along = cx * S.Uhx + cy * S.Uhy;
  const perp = cx * -S.Uhy + cy * S.Uhx;
  const a2 = along * 1.0;
  const p2 = perp * params.anisotropy;
  cx = a2 * S.Uhx + p2 * -S.Uhy;
  cy = a2 * S.Uhy + p2 * S.Uhx;
  return [cx, cy];
}

/** Map turbulence intensity to the visual fluctuation amplitude used by `arrowAt`. */
export function turbulenceAmplitude(TI: number): number {
  return lerp(0.12, 0.9, smoothstep(0.03, 0.67, TI));
}

/** Length-variance multiplier: 1 at calm, ramping to `lengthRampFactor` at high wind. */
export function lengthRampMultiplier(
  params: FlowFieldParams,
  speedNorm: number
): number {
  return lerp(1, params.lengthRampFactor, smoothstep(0.2, 1, speedNorm));
}

export interface Arrow {
  hx: number;
  hy: number;
  /** stroke length in px (caller scales by cell size) */
  lenScale: number;
  /** ink alpha 0..1 */
  alpha: number;
}

/**
 * Resolve one arrow at grid cell (px,py) with letter coverage `cov` (0..1).
 * Reynolds decomposition u = U + u', in-letter jitter clamp, length ramp with wind speed.
 */
export function arrowAt(
  px: number,
  py: number,
  cov: number,
  turb0: number,
  S: FieldState,
  params: FlowFieldParams,
  fbm: Noise3
): Arrow {
  const [cx, cy] = curl(px, py, S, params, fbm);
  const tl = turb0 * lerp(params.letterJitter, 1, 1 - cov) * S.pulse;
  const ux = S.Uhx + cx * tl;
  const uy = S.Uhy + cy * tl;
  const spd = Math.hypot(ux, uy) || 1;
  const hx = ux / spd;
  const hy = uy / spd;
  // length variance intensifies with wind speed → stormy feel at high winds
  const effVar = params.lengthVariance * lengthRampMultiplier(params, S.speedNorm);
  const lenScale = (1 + effVar * (spd - 1)) * lerp(0.28, 1, cov);
  const alpha = 0.12 + 0.8 * cov;
  return { hx, hy, lenScale, alpha };
}
