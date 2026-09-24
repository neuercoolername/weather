// The hand-drawn ring for a crossing mark (pure / no DOM).
//
// A ring is drawn at unit radius around (0,0) and scaled on screen, so one path serves
// every size and the breathing loop only has to change a scale. Randomness is injected
// as `rand` — the app passes Math.random (a new hand every page load), tests pass a
// seeded generator. Tuned in the prototype bench; see docs/features/hand-drawn-marks.

export type RingStyle = "overshoot" | "gap" | "closed" | "multi";

export interface RingShapeParams {
  /** how often each style is picked, relative to the others */
  weights: Record<RingStyle, number>;
  /** total outline wobble, fraction of the radius */
  roughness: number;
  /** how many lump frequencies are layered (2, 3, 4… lumps per turn) */
  harmonics: number;
  /** higher = less energy in the higher lump frequencies, so a smoother outline */
  falloff: number;
  /** random squash, fraction of the radius */
  ellipse: number;
  /** radius change from pen-down to pen-up, fraction of the radius */
  drift: number;
  /** non-integer offset on the lump frequencies, so a later pass never retraces an earlier one */
  freqDrift: number;
  /** path samples per full turn */
  samples: number;
  /** degrees the pen runs past its start (overshoot) */
  overshootDeg: [number, number];
  /** degrees the pen stops short of its start (gap) */
  gapDeg: [number, number];
  /** turns for a multi-pass ring */
  passes: [number, number];
  /** extra radius drift per turn beyond the first (multi-pass) */
  passDrift: number;
  /** slow radius wander along the stroke, not locked to the turn: passes drift apart and together */
  wander: number;
  /** the loop's centre slides while drawing, per turn, so passes are not concentric */
  centerDrift: number;
  /** the pen lands off the circle and swings onto it */
  leadIn: number;
  /** the pen leaves the circle as it lifts */
  flick: number;
  /** degrees over which the lead-in and flick settle */
  tailDeg: number;
}

export const DEFAULT_RING_SHAPE_PARAMS: RingShapeParams = {
  weights: { overshoot: 1, gap: 1, closed: 0.5, multi: 1 },
  roughness: 0.07,
  harmonics: 3,
  falloff: 1.2,
  ellipse: 0.07,
  drift: 0.06,
  freqDrift: 0.12,
  samples: 40,
  overshootDeg: [15, 45],
  gapDeg: [12, 40],
  passes: [1.6, 2.3],
  passDrift: 0.08,
  wander: 0.05,
  centerDrift: 0.07,
  leadIn: 0.1,
  flick: 0.12,
  tailDeg: 30,
};

const TURN = Math.PI * 2;
const DEG = Math.PI / 180;

const STYLES: RingStyle[] = ["overshoot", "gap", "closed", "multi"];

/** Picks a style from the weights. With every weight at zero the ring stays closed. */
export function pickRingStyle(u: number, weights: RingShapeParams["weights"]): RingStyle {
  const total = STYLES.reduce((s, style) => s + Math.max(0, weights[style]), 0);
  if (total <= 0) return "closed";
  let left = u * total;
  for (const style of STYLES) {
    left -= Math.max(0, weights[style]);
    if (left < 0) return style;
  }
  return STYLES[STYLES.length - 1];
}

const between = ([lo, hi]: [number, number], u: number) => lo + u * Math.max(0, hi - lo);

export interface Ring {
  points: [number, number][];
  /** the ends meet, so the path is drawn closed */
  closed: boolean;
  /** how far round the pen travels, radians */
  sweep: number;
}

export function ringPoints(
  rand: () => number,
  style: RingStyle,
  params: RingShapeParams
): Ring {
  const harmonics = Array.from({ length: Math.max(0, Math.round(params.harmonics)) }, (_, i) => {
    const f = i + 2;
    return {
      f,
      amp: (0.5 + rand()) / Math.pow(f - 1, params.falloff),
      phase: rand() * TURN,
      freqOffset: rand() * 2 - 1,
    };
  });
  const squash = 1 + (rand() * 2 - 1) * params.ellipse;
  const tilt = rand() * Math.PI;
  const start = rand() * TURN;
  const dir = rand() < 0.75 ? 1 : -1; // most people draw a circle the same way round
  const driftSign = rand() < 0.5 ? -1 : 1;
  const leadIn = params.leadIn * (rand() < 0.5 ? -1 : 1) * (0.4 + 0.6 * rand());
  const flick = params.flick * (rand() < 0.6 ? 1 : -1) * (0.4 + 0.6 * rand());
  // Cycles per turn well away from whole numbers, so the gap between one pass and the
  // next opens and closes instead of running parallel.
  const wanderTerms = [0, 1].map(() => ({
    c: 0.3 + 0.5 * rand(),
    phase: rand() * TURN,
    amp: 0.5 + rand(),
  }));
  const centreAngle = rand() * TURN;

  const closed = style === "closed";
  let sweep = TURN;
  let drift = params.drift * driftSign;
  if (style === "overshoot") sweep = TURN + between(params.overshootDeg, rand()) * DEG;
  else if (style === "gap") sweep = TURN - between(params.gapDeg, rand()) * DEG;
  else if (style === "multi") {
    const turns = between(params.passes, rand());
    sweep = TURN * turns;
    drift = driftSign * (params.drift + params.passDrift * (turns - 1));
  } else drift = 0;

  const norm = harmonics.reduce((s, h) => s + h.amp, 0);
  const lumpScale = norm > 0 ? params.roughness / norm : 0;
  const tail = Math.max(1, params.tailDeg) * DEG;
  const turns = sweep / TURN;
  const n = Math.max(8, Math.round((params.samples * sweep) / TURN));

  const points: [number, number][] = [];
  // A closed ring leaves out its last sample: it would sit on the first.
  for (let i = 0; i <= (closed ? n - 1 : n); i++) {
    const t = i / n;
    const th = sweep * t;
    let radius = 1 + drift * (t - 0.5);
    for (const h of harmonics) {
      // Whole-number frequencies only on a closed ring, so its outline meets itself.
      const f = closed ? h.f : h.f + h.freqOffset * params.freqDrift;
      radius += lumpScale * h.amp * Math.sin(f * th + h.phase);
    }
    let cx = 0;
    let cy = 0;
    if (!closed) {
      for (const w of wanderTerms) radius += params.wander * w.amp * 0.5 * Math.sin(w.c * th + w.phase);
      radius += leadIn * Math.exp(-th / tail);
      radius += flick * Math.exp(-(sweep - th) / tail);
      const slide = params.centerDrift * turns * (t - 0.5);
      cx = Math.cos(centreAngle) * slide;
      cy = Math.sin(centreAngle) * slide;
    }
    const a = start + dir * th;
    const x = Math.cos(a) * radius * squash;
    const y = (Math.sin(a) * radius) / squash;
    points.push([
      x * Math.cos(tilt) - y * Math.sin(tilt) + cx,
      x * Math.sin(tilt) + y * Math.cos(tilt) + cy,
    ]);
  }
  return { points, closed, sweep };
}

/** Catmull-Rom through the samples, written as cubic Béziers. */
export function ringPath({ points, closed }: Ring): string {
  const n = points.length;
  const at = (i: number) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  const f = (v: number) => v.toFixed(4);
  let d = `M${f(points[0][0])},${f(points[0][1])}`;
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d +=
      `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ` +
      `${f(p2[0])},${f(p2[1])}`;
  }
  return closed ? d + "Z" : d;
}

/** One hand-drawn ring as a unit-radius SVG path around (0,0). */
export function handDrawnRingPath(rand: () => number, params: RingShapeParams): string {
  const style = pickRingStyle(rand(), params.weights);
  return ringPath(ringPoints(rand, style, params));
}

/** The unit circle as a path: what a ring draws before its hand-drawn shape exists. */
export const UNIT_CIRCLE_PATH = "M1,0A1,1 0 1,1 -1,0A1,1 0 1,1 1,0Z";
