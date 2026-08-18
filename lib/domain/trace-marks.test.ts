import { describe, it, expect } from "vitest";
import {
  DEFAULT_TRACE_MARK_PARAMS,
  MAX_SCALE,
  breathingPhase,
  breathingRadius,
  groupMarks,
  groupRadius,
  markMetrics,
  openAction,
  splitScale,
  type MarkGroup,
  type TraceMarkParams,
} from "./trace-marks";

const P = DEFAULT_TRACE_MARK_PARAMS;
const KFIT = 0.072; // the real fitted scale at the time of tuning

// A transform that maps data units straight to screen px at scale k, no translation.
const at = (k: number) => ({ x: 0, y: 0, k });

describe("markMetrics", () => {
  it("renders the base width when the whole trace is fitted", () => {
    const m = markMetrics(KFIT, KFIT, P);
    expect(m.z).toBeCloseTo(1);
    expect(m.traceWidth).toBeCloseTo(P.traceBaseWidth);
  });

  it("holds the mark:trace stroke ratio at every zoom", () => {
    for (const z of [1, 2, 14, 100, 278]) {
      const m = markMetrics(KFIT * z, KFIT, P);
      expect(m.markStroke / m.traceWidth).toBeCloseTo(P.markerRatio);
    }
  });

  it("grows the mark radius faster than the ink, per its own exponent", () => {
    const near = markMetrics(KFIT, KFIT, P);
    const far = markMetrics(KFIT * 100, KFIT, P);
    expect(far.markSize / near.markSize).toBeGreaterThan(far.traceWidth / near.traceWidth);
  });

  it("is screen-fixed at exponent 0 and world-locked at exponent 1", () => {
    const fixed: TraceMarkParams = { ...P, scaleExponent: 0 };
    expect(markMetrics(KFIT * 50, KFIT, fixed).traceWidth).toBeCloseTo(P.traceBaseWidth);

    const world: TraceMarkParams = { ...P, scaleExponent: 1 };
    expect(markMetrics(KFIT * 50, KFIT, world).traceWidth).toBeCloseTo(P.traceBaseWidth * 50);
  });

  it("does not divide by a zero fit scale", () => {
    expect(Number.isFinite(markMetrics(1, 0, P).traceWidth)).toBe(true);
  });
});

describe("groupMarks", () => {
  const markSize = 5;
  const link = markSize * P.mergeFactor; // 6px at the default

  it("groups marks closer than the link distance", () => {
    const groups = groupMarks(
      [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: link * 0.5, y: 0 },
      ],
      at(1),
      markSize,
      P
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.id)).toEqual([1, 2]);
  });

  it("leaves marks further apart than the link distance alone", () => {
    const groups = groupMarks(
      [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: link * 2, y: 0 },
      ],
      at(1),
      markSize,
      P
    );
    expect(groups).toHaveLength(2);
  });

  // Regression guard: an earlier build bucketed by a screen-space grid, so whether two
  // marks merged depended on which side of an arbitrary cell boundary they fell — a hair
  // of zoom flipped them and the drawn centroid teleported. Distance-based clustering
  // must not care where the pair sits in absolute coordinates.
  it("groups a close pair wherever it sits, not only inside a cell", () => {
    const separation = link * 0.5;
    for (const origin of [0, 0.4, 5.9, 6.1, 123.7, -48.2]) {
      const groups = groupMarks(
        [
          { id: 1, x: origin, y: origin },
          { id: 2, x: origin + separation, y: origin },
        ],
        at(1),
        markSize,
        P
      );
      expect(groups, `origin ${origin}`).toHaveLength(1);
    }
  });

  it("chains transitively — a link at a time, not a bounding box", () => {
    const step = link * 0.6;
    const groups = groupMarks(
      [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: step, y: 0 },
        { id: 3, x: step * 2, y: 0 },
      ],
      at(1),
      markSize,
      P
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(3);
  });

  it("dissolves a group as the camera scales the pair apart", () => {
    const points = [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 4, y: 0 },
    ];
    expect(groupMarks(points, at(1), markSize, P)).toHaveLength(1);
    expect(groupMarks(points, at(10), markSize, P)).toHaveLength(2);
  });

  it("reports the centroid and spread of a group", () => {
    const groups = groupMarks(
      [
        { id: 1, x: -2, y: 0 },
        { id: 2, x: 2, y: 0 },
      ],
      at(1),
      markSize,
      P
    );
    expect(groups[0].cx).toBeCloseTo(0);
    expect(groups[0].cy).toBeCloseTo(0);
    expect(groups[0].spread).toBeCloseTo(2);
  });

  it("returns nothing for no points", () => {
    expect(groupMarks([], at(1), markSize, P)).toEqual([]);
  });
});

describe("groupRadius", () => {
  it("encloses the group's footprint, and is just the mark for a single", () => {
    const single: MarkGroup = { members: [{ id: 1, x: 0, y: 0 }], cx: 0, cy: 0, spread: 0 };
    expect(groupRadius(single, 5)).toBeCloseTo(5);

    const many: MarkGroup = {
      members: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 1, y: 0 },
      ],
      cx: 0,
      cy: 0,
      spread: 12,
    };
    expect(groupRadius(many, 5)).toBeCloseTo(17);
  });
});

describe("splitScale", () => {
  const pair = (separation: number): MarkGroup => ({
    members: [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: separation, y: 0 },
    ],
    cx: 0,
    cy: 0,
    spread: separation / 2,
  });

  it("needs more zoom the closer the pair is", () => {
    const near = splitScale(pair(0.5), KFIT, P);
    const mid = splitScale(pair(5), KFIT, P);
    const far = splitScale(pair(50), KFIT, P);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
  });

  it("never separates coincident members", () => {
    expect(splitScale(pair(0), KFIT, P)).toBe(Infinity);
  });

  it("puts the real hairpin out of reach and an ordinary pair within it", () => {
    // crossings 93/95/96 sit ~0.02 units apart; a comfortable pair is tens of units
    expect(splitScale(pair(0.02), KFIT, P)).toBeGreaterThan(MAX_SCALE);
    expect(splitScale(pair(40), KFIT, P)).toBeLessThan(MAX_SCALE);
  });

  it("actually splits the group at the scale it reports", () => {
    const separation = 8;
    const g = pair(separation);
    const k = splitScale(g, KFIT, P);
    const below = markMetrics(k * 0.9, KFIT, P);
    const above = markMetrics(k * 1.1, KFIT, P);
    expect(groupMarks(g.members, at(k * 0.9), below.markSize, P)).toHaveLength(1);
    expect(groupMarks(g.members, at(k * 1.1), above.markSize, P)).toHaveLength(2);
  });
});

describe("openAction", () => {
  const group = (...members: { id: number; x: number; y: number }[]): MarkGroup => ({
    members,
    cx: 0,
    cy: 0,
    spread: 0,
  });

  it("selects a lone mark", () => {
    expect(openAction(group({ id: 7, x: 0, y: 0 }), KFIT, P)).toEqual({
      kind: "select",
      id: 7,
    });
  });

  it("zooms to a resolvable group, centred on it", () => {
    const action = openAction(group({ id: 1, x: 0, y: 0 }, { id: 2, x: 40, y: 10 }), KFIT, P);
    expect(action.kind).toBe("zoom");
    if (action.kind !== "zoom") return;
    expect(action.cx).toBeCloseTo(20);
    expect(action.cy).toBeCloseTo(5);
    expect(action.k).toBeLessThanOrEqual(MAX_SCALE);
  });

  it("overshoots the split so the group is clearly open", () => {
    const g = group({ id: 1, x: 0, y: 0 }, { id: 2, x: 60, y: 0 });
    const action = openAction(g, KFIT, P);
    if (action.kind !== "zoom") throw new Error("expected a zoom");
    expect(action.k).toBeCloseTo(splitScale(g, KFIT, P) * P.openMargin);
  });

  it("falls back to the first member when zoom can never separate the group", () => {
    // the real hairpin: three crossings within 0.02 units, needing k ~= 470
    const action = openAction(
      group({ id: 95, x: 0, y: 0 }, { id: 93, x: 0.011, y: 0 }, { id: 96, x: 0.021, y: 0 }),
      KFIT,
      P
    );
    expect(action).toEqual({ kind: "select", id: 93 });
  });

  it("never asks the camera for more than it can give", () => {
    const action = openAction(group({ id: 1, x: 0, y: 0 }, { id: 2, x: 0.3, y: 0 }), KFIT, P);
    if (action.kind === "zoom") expect(action.k).toBeLessThanOrEqual(MAX_SCALE);
  });
});

describe("breathingRadius", () => {
  it("swings around the resting radius and stays positive", () => {
    const params: TraceMarkParams = { ...P, pulseDepth: 0.5, pulseFloorPx: 0 };
    const samples = [0, 1, 2, 3, 4, 5, 6, 7].map((s) =>
      breathingRadius(10, s, 0, params)
    );
    expect(Math.max(...samples)).toBeGreaterThan(10);
    expect(Math.min(...samples)).toBeLessThan(10);
    expect(Math.min(...samples)).toBeGreaterThan(0);
  });

  it("keeps a small ring visibly moving via the px floor", () => {
    const params: TraceMarkParams = { ...P, pulseDepth: 0.22, pulseFloorPx: 2 };
    const quarter = params.pulsePeriodSec / 4;
    const rest = breathingRadius(4.5, 0, 0, params);
    const peak = breathingRadius(4.5, quarter, 0, params);
    expect(peak - rest).toBeCloseTo(2, 1);
  });

  it("does not move at all when depth and floor are zero", () => {
    const params: TraceMarkParams = { ...P, pulseDepth: 0, pulseFloorPx: 0 };
    expect(breathingRadius(6, 0, 0, params)).toBeCloseTo(6);
    expect(breathingRadius(6, 3, 0, params)).toBeCloseTo(6);
  });
});

describe("breathingPhase", () => {
  it("is stable for one crossing and differs across crossings", () => {
    const a = new Date("2026-04-04T10:00:00Z");
    const b = new Date("2026-04-04T10:00:03Z");
    expect(breathingPhase(a, P)).toBeCloseTo(breathingPhase(new Date(a), P));
    expect(breathingPhase(a, P)).not.toBeCloseTo(breathingPhase(b, P));
  });

  it("stays within one turn", () => {
    for (const iso of ["1999-01-01T00:00:00Z", "2026-08-17T13:37:11Z", "2030-12-31T23:59:59Z"]) {
      const phase = breathingPhase(new Date(iso), P);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(Math.PI * 2);
    }
  });
});
