import { describe, it, expect } from "vitest";
import { computeWeaveSegments, buildWeavePaths } from "./weave";

// Use a small custom gap so segments in tests are always long enough to avoid the 25% cap.
const SMALL_GAP = 0.5;
const SMALL_GAP_HALF = SMALL_GAP / 2;

function pt(id: number, x: number, y: number) {
  return { id, x, y };
}

describe("computeWeaveSegments", () => {
  it("returns empty array when fewer than 2 trace points", () => {
    expect(computeWeaveSegments([], [], SMALL_GAP)).toEqual([]);
    expect(computeWeaveSegments([pt(1, 0, 0)], [], SMALL_GAP)).toEqual([]);
  });

  it("passthrough: no crossings returns one sub-segment per base segment", () => {
    const points = [pt(1, 0, 0), pt(2, 10, 0), pt(3, 20, 0)];
    const subs = computeWeaveSegments(points, [], SMALL_GAP);
    expect(subs).toHaveLength(2);
    expect(subs[0]).toEqual({ start: { x: 0, y: 0 }, end: { x: 10, y: 0 } });
    expect(subs[1]).toEqual({ start: { x: 10, y: 0 }, end: { x: 20, y: 0 } });
  });

  it("under-segment gets gap; over-segment stays unbroken", () => {
    // Segment 0 (pt1→pt2): older, under at x=5
    // Segment 1 (pt2→pt3): newer, over — should remain 1 unbroken sub-segment
    // tracePointIdA=2 → older segment ends at pt2, so older seg idx = 1-1 = 0
    // tracePointIdB=3 → newer segment ends at pt3, so newer seg idx = 2-1 = 1
    const points = [pt(1, 0, 0), pt(2, 10, 0), pt(3, 20, 0)];
    const intersections = [{ x: 5, y: 0, tracePointIdA: 2, tracePointIdB: 3 }];
    const subs = computeWeaveSegments(points, intersections, SMALL_GAP);

    // Segment 0 (under): 2 sub-segs with gap around x=5
    // Segment 1 (over): 1 unbroken sub-seg
    expect(subs).toHaveLength(3);

    // First half of under-segment: retreated end
    expect(subs[0].start).toEqual({ x: 0, y: 0 });
    expect(subs[0].end.x).toBeCloseTo(5 - SMALL_GAP_HALF);
    expect(subs[0].end.y).toBeCloseTo(0);

    // Second half of under-segment: advanced start
    expect(subs[1].start.x).toBeCloseTo(5 + SMALL_GAP_HALF);
    expect(subs[1].start.y).toBeCloseTo(0);
    expect(subs[1].end).toEqual({ x: 10, y: 0 });

    // Over-segment: completely unbroken
    expect(subs[2]).toEqual({ start: { x: 10, y: 0 }, end: { x: 20, y: 0 } });
  });

  it("a segment that is under at one crossing and over at another: only under-crossing gets gap", () => {
    // 4 points, 3 segments (0, 1, 2)
    // Intersection A: segment 1 (idx=1) is UNDER → tracePointIdA=3 (end of seg 1)
    //   tracePointIdA=3 at idx=2, older seg idx = 2-1 = 1
    // Segment 0 and 2 have no crossings
    const points = [pt(1, 0, 0), pt(2, 10, 0), pt(3, 20, 0), pt(4, 30, 0)];
    const intersections = [{ x: 15, y: 0, tracePointIdA: 3, tracePointIdB: 4 }];
    const subs = computeWeaveSegments(points, intersections, SMALL_GAP);

    // Segment 0: 1 sub-seg (no crossing)
    // Segment 1: 2 sub-segs with gap at x=15
    // Segment 2: 1 sub-seg (over — not split)
    expect(subs).toHaveLength(4);

    expect(subs[0]).toEqual({ start: { x: 0, y: 0 }, end: { x: 10, y: 0 } });

    expect(subs[1].start).toEqual({ x: 10, y: 0 });
    expect(subs[1].end.x).toBeCloseTo(15 - SMALL_GAP_HALF);

    expect(subs[2].start.x).toBeCloseTo(15 + SMALL_GAP_HALF);
    expect(subs[2].end).toEqual({ x: 20, y: 0 });

    expect(subs[3]).toEqual({ start: { x: 20, y: 0 }, end: { x: 30, y: 0 } });
  });

  it("multiple crossings on one under-segment produces N+1 sub-segments with gaps", () => {
    // Segment 0 (30 units): under at x=10 and x=20 — gaps should be SMALL_GAP_HALF each
    // No cap applies: each sub-seg is 10 units; cap=10*0.25=2.5 >> SMALL_GAP_HALF=0.25
    const points = [pt(1, 0, 0), pt(2, 30, 0), pt(3, 5, 5), pt(4, 5, 10)];
    const intersections = [
      { x: 10, y: 0, tracePointIdA: 2, tracePointIdB: 3 },
      { x: 20, y: 0, tracePointIdA: 2, tracePointIdB: 4 },
    ];
    const subs = computeWeaveSegments(points, intersections, SMALL_GAP);

    // Segment 0 (under at x=10 and x=20): 3 sub-segs
    const seg0 = subs.slice(0, 3);
    expect(seg0).toHaveLength(3);

    expect(seg0[0].start).toEqual({ x: 0, y: 0 });
    expect(seg0[0].end.x).toBeCloseTo(10 - SMALL_GAP_HALF);

    expect(seg0[1].start.x).toBeCloseTo(10 + SMALL_GAP_HALF);
    expect(seg0[1].end.x).toBeCloseTo(20 - SMALL_GAP_HALF);

    expect(seg0[2].start.x).toBeCloseTo(20 + SMALL_GAP_HALF);
    expect(seg0[2].end).toEqual({ x: 30, y: 0 });
  });

  it("gap is capped symmetrically using the shorter of the two adjacent sub-segments", () => {
    // Segment 0: length 2, crossing at x=1.9 → sub-seg A=1.9 units, sub-seg B=0.1 units
    // Shared cap = min(1.9, 0.1) * 0.25 = 0.025 → both sides use 0.025
    const points = [pt(1, 0, 0), pt(2, 2, 0), pt(3, 5, 5)];
    const crossingX = 1.9;
    const intersections = [{ x: crossingX, y: 0, tracePointIdA: 2, tracePointIdB: 3 }];
    const subs = computeWeaveSegments(points, intersections, 2.5);

    const sharedCap = Math.min(1.9, 0.1) * 0.25; // 0.025
    // Sub-seg A: end retreated by sharedCap from crossing
    expect(subs[0].end.x).toBeCloseTo(crossingX - sharedCap);
    // Sub-seg B: start advanced by sharedCap from crossing
    expect(subs[1].start.x).toBeCloseTo(crossingX + sharedCap);
    expect(subs[1].end).toEqual({ x: 2, y: 0 });
  });

  it("skips intersections where trace point ids are not found", () => {
    const points = [pt(1, 0, 0), pt(2, 10, 0)];
    const intersections = [{ x: 5, y: 0, tracePointIdA: 99, tracePointIdB: 100 }];
    const subs = computeWeaveSegments(points, intersections, SMALL_GAP);
    expect(subs).toHaveLength(1);
    expect(subs[0]).toEqual({ start: { x: 0, y: 0 }, end: { x: 10, y: 0 } });
  });
});

describe("buildWeavePaths", () => {
  it("returns empty array for no sub-segments", () => {
    expect(buildWeavePaths([])).toEqual([]);
  });

  it("groups connected sub-segments into one path", () => {
    const subs = [
      { start: { x: 0, y: 0 }, end: { x: 5, y: 0 } },
      { start: { x: 5, y: 0 }, end: { x: 10, y: 0 } },
    ];
    const paths = buildWeavePaths(subs);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toBe("M 0,0 L 5,0 L 10,0");
  });

  it("splits disconnected sub-segments into separate paths", () => {
    const subs = [
      { start: { x: 0, y: 0 }, end: { x: 4, y: 0 } },
      { start: { x: 6, y: 0 }, end: { x: 10, y: 0 } },
    ];
    const paths = buildWeavePaths(subs);
    expect(paths).toHaveLength(2);
    expect(paths[0]).toBe("M 0,0 L 4,0");
    expect(paths[1]).toBe("M 6,0 L 10,0");
  });

  it("flips y when flipY=true", () => {
    const subs = [{ start: { x: 0, y: 5 }, end: { x: 10, y: -3 } }];
    const paths = buildWeavePaths(subs, true);
    expect(paths[0]).toBe("M 0,-5 L 10,3");
  });
});
