// Weight and grouping for the trace and its crossing marks (pure / no DOM).
//
// The trace's stroke and its marks are one system: both are derived from the same
// relative zoom, so the ratio between them is fixed by `markerRatio` and holds at
// every scale. Everything keys off `z = k / kFit` rather than the raw camera scale,
// because `kFit` is data-dependent and shrinks as the trace grows — absolute `k`
// thresholds would drift over time, `z = 1` ("the whole trace framed") does not.
//
// Where marks crowd together they collapse into one group ring drawn to enclose the
// group's real footprint, so ring size means "how much room this group takes up" and
// nothing else. See docs/features/trace-marks.

import { projectToScreen } from "./trace-viewport";

// ---- tunable "feel" parameters (mirror the tuning bench's panel) ----
export interface TraceMarkParams {
  /** trace stroke px = traceBaseWidth · z^this; 0 = screen-fixed, 1 = world-locked */
  scaleExponent: number;
  /** trace stroke px at z = 1 (the whole trace fitted) */
  traceBaseWidth: number;
  /** mark stroke ÷ trace stroke — constant at every zoom */
  markerRatio: number;
  /** ring radius px at z = 1 */
  markerSize: number;
  /** ring radius px = markerSize · z^this; kept separate so the mark can grow more slowly than the ink */
  markSizeExponent: number;
  /** group link distance as a multiple of mark size, measured on screen */
  mergeFactor: number;
  /** click-to-open zoom, × the zoom at which the group first splits */
  openMargin: number;
  /** ring radius multiplier while hovered */
  hoverGrowth: number;
  /** ring radius multiplier while open */
  activeGrowth: number;
  /** mark stroke multiplier while open */
  activeStrokeRatio: number;
  /** invisible hit circle radius, fixed screen px */
  hitRadius: number;
  /** breathing swing as a fraction of the ring radius */
  pulseDepth: number;
  /** breathing minimum swing in px, so small rings still visibly breathe */
  pulseFloorPx: number;
  /** breathing period, seconds */
  pulsePeriodSec: number;
}

export const DEFAULT_TRACE_MARK_PARAMS: TraceMarkParams = {
  scaleExponent: 0.05,
  traceBaseWidth: 0.4,
  markerRatio: 1,
  markerSize: 4.5,
  markSizeExponent: 0.22,
  mergeFactor: 1.2,
  openMargin: 2.02,
  hoverGrowth: 1.875,
  activeGrowth: 1.875,
  activeStrokeRatio: 2,
  hitRadius: 20,
  pulseDepth: 0.22,
  pulseFloorPx: 0,
  pulsePeriodSec: 7.4,
};

/** Upper bound on the camera scale. Shared by the camera and by openAction, so
 *  "as far as you can zoom" means one thing. */
export const MAX_SCALE = 20;

export interface MarkMetrics {
  /** relative zoom: 1 = the whole trace fitted */
  z: number;
  /** trace stroke width in screen px */
  traceWidth: number;
  /** mark stroke width in screen px */
  markStroke: number;
  /** mark (ring) radius in screen px */
  markSize: number;
}

// Both widths come from the same curve, so markStroke / traceWidth === markerRatio
// at every zoom — that fixed ratio is the whole point of the model.
export function markMetrics(
  k: number,
  kFit: number,
  params: TraceMarkParams
): MarkMetrics {
  const z = kFit > 0 ? k / kFit : 1;
  const traceWidth = params.traceBaseWidth * Math.pow(z, params.scaleExponent);
  return {
    z,
    traceWidth,
    markStroke: traceWidth * params.markerRatio,
    markSize: params.markerSize * Math.pow(z, params.markSizeExponent),
  };
}

interface Point {
  id: number;
  x: number;
  y: number;
}

export interface MarkGroup<T extends Point = Point> {
  members: T[];
  /** centroid in screen px */
  cx: number;
  cy: number;
  /** furthest member from the centroid, screen px */
  spread: number;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

// Single-link clustering in screen space. Deliberately distance-based rather than
// snapped to a grid: a grid has arbitrary cell boundaries, so a hair of zoom flips
// members between cells and the drawn centroid teleports.
export function groupMarks<T extends Point>(
  points: readonly T[],
  transform: Transform,
  markSize: number,
  params: TraceMarkParams
): MarkGroup<T>[] {
  const linkDistance = markSize * params.mergeFactor;
  const placed = points.map((p) => {
    const { sx, sy } = projectToScreen(p, transform);
    return { point: p, sx, sy };
  });

  const seen = new Array(placed.length).fill(false);
  const groups: MarkGroup<T>[] = [];

  for (let i = 0; i < placed.length; i++) {
    if (seen[i]) continue;
    seen[i] = true;
    const stack = [i];
    const cluster = [placed[i]];

    while (stack.length > 0) {
      const u = stack.pop()!;
      for (let j = 0; j < placed.length; j++) {
        if (seen[j]) continue;
        const d = Math.hypot(placed[j].sx - placed[u].sx, placed[j].sy - placed[u].sy);
        if (d < linkDistance) {
          seen[j] = true;
          stack.push(j);
          cluster.push(placed[j]);
        }
      }
    }

    const cx = cluster.reduce((s, m) => s + m.sx, 0) / cluster.length;
    const cy = cluster.reduce((s, m) => s + m.sy, 0) / cluster.length;
    let spread = 0;
    for (const m of cluster) {
      spread = Math.max(spread, Math.hypot(m.sx - cx, m.sy - cy));
    }

    groups.push({
      members: cluster.map((m) => m.point),
      cx,
      cy,
      spread,
    });
  }

  return groups;
}

/** The member a group is identified and opened by: its lowest id. One rule, so the
 *  ring's key, the crossing named in the header and the one a click opens all agree. */
export function groupKey<T extends Point>(group: MarkGroup<T>): T {
  return group.members.reduce((a, b) => (b.id < a.id ? b : a));
}

/** Radius of the ring drawn for a group: it encloses the group's real footprint,
 *  so it grows with that footprint as you zoom and then the group dissolves. */
export function groupRadius(group: MarkGroup, markSize: number): number {
  return group.members.length > 1 ? group.spread + markSize : markSize;
}

// Longest edge of the group's minimum spanning tree, in data units. This is the
// link that has to stretch past the threshold for the group to come apart.
function longestSpanningEdge(members: readonly Point[]): number {
  const n = members.length;
  if (n < 2) return 0;

  const inTree = new Array(n).fill(false);
  const best = new Array(n).fill(Infinity);
  inTree[0] = true;
  for (let i = 1; i < n; i++) {
    best[i] = Math.hypot(members[i].x - members[0].x, members[i].y - members[0].y);
  }

  let longest = 0;
  for (let done = 1; done < n; done++) {
    let pick = -1;
    let pickDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (!inTree[i] && best[i] < pickDist) {
        pickDist = best[i];
        pick = i;
      }
    }
    if (pick < 0) break;
    inTree[pick] = true;
    longest = Math.max(longest, pickDist);
    for (let i = 0; i < n; i++) {
      if (inTree[i]) continue;
      const d = Math.hypot(members[i].x - members[pick].x, members[i].y - members[pick].y);
      if (d < best[i]) best[i] = d;
    }
  }
  return longest;
}

// The camera scale at which a group first splits. Members are linked while they are
// within `markSize(z) · mergeFactor` screen px, so the group survives while
//   longest · k < markerSize · mergeFactor · (k/kFit)^markSizeExponent
// Solving for k gives the scale below. Infinity when the members are coincident,
// which no amount of zoom can separate.
export function splitScale(
  group: MarkGroup,
  kFit: number,
  params: TraceMarkParams
): number {
  const longest = longestSpanningEdge(group.members);
  if (longest <= 0) return Infinity;
  const a =
    (params.markerSize * params.mergeFactor) / Math.pow(kFit, params.markSizeExponent);
  return Math.pow(a / longest, 1 / (1 - params.markSizeExponent));
}

export type OpenAction =
  /** fly the camera here — the group comes apart at this scale */
  | { kind: "zoom"; k: number; cx: number; cy: number }
  /** the group cannot be separated within the zoom range; open this member instead */
  | { kind: "select"; id: number };

// What clicking a mark should do.
//
// A group opens by zooming only as far as its *first* split, not to its bounding box:
// fitting the box overshoots and throws the other members off screen, so a three-member
// group often opens into a single mark plus a pair, keeping the reveal gradual.
//
// When that scale is out of reach, zooming can never resolve the group, so fall back to
// opening the first of its members — the rest stay reachable through the panel's
// prev/next, which is the likelier route anyway.
export function openAction(
  group: MarkGroup,
  kFit: number,
  params: TraceMarkParams,
  maxScale: number = MAX_SCALE
): OpenAction {
  if (group.members.length === 1) {
    return { kind: "select", id: group.members[0].id };
  }

  const split = splitScale(group, kFit, params);
  if (!Number.isFinite(split) || split > maxScale) {
    return { kind: "select", id: groupKey(group).id };
  }

  const xs = group.members.map((m) => m.x);
  const ys = group.members.map((m) => m.y);
  return {
    kind: "zoom",
    k: Math.min(split * params.openMargin, maxScale),
    cx: (Math.min(...xs) + Math.max(...xs)) / 2,
    cy: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

// Breathing radius for a mark. A purely proportional swing vanishes on a small ring
// (4.5px × 0.22 ≈ 1px reads as static), so the amplitude has a px floor.
export function breathingRadius(
  radius: number,
  seconds: number,
  phase: number,
  params: TraceMarkParams
): number {
  const amplitude = Math.max(radius * params.pulseDepth, params.pulseFloorPx);
  const swing = Math.sin((seconds * Math.PI * 2) / params.pulsePeriodSec + phase);
  return Math.max(0.1, radius + amplitude * swing);
}

// Per-mark phase offset, so marks don't pulse in unison. Keyed to the moment the
// crossing was recorded rather than to its coordinates: the rhythm then comes from
// something the crossing actually is, not from an invented number.
export function breathingPhase(recordedAt: Date, params: TraceMarkParams): number {
  const periodMs = params.pulsePeriodSec * 1000;
  const offset = ((recordedAt.getTime() % periodMs) + periodMs) % periodMs;
  return (offset / periodMs) * Math.PI * 2;
}
