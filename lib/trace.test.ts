import { describe, it, expect } from "vitest";
import { computeTracePoint, segmentsIntersect } from "./trace";

describe("computeTracePoint", () => {
  it("north wind (0°) moves point north (y decreases)", () => {
    const result = computeTracePoint(0, 0, 0, 10);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(-10);
  });

  it("south wind (180°) moves point south (y increases)", () => {
    const result = computeTracePoint(0, 0, 180, 10);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(10);
  });

  it("east wind (90°) moves point east (x increases)", () => {
    const result = computeTracePoint(0, 0, 90, 10);
    expect(result.x).toBeCloseTo(10);
    expect(result.y).toBeCloseTo(0);
  });

  it("west wind (270°) moves point west (x decreases)", () => {
    const result = computeTracePoint(0, 0, 270, 10);
    expect(result.x).toBeCloseTo(-10);
    expect(result.y).toBeCloseTo(0);
  });

  it("zero speed produces no displacement", () => {
    const result = computeTracePoint(5, 7, 45, 0);
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(7);
  });

  it("accumulates from a non-origin previous point", () => {
    const result = computeTracePoint(3, 4, 0, 5);
    expect(result.x).toBeCloseTo(3);
    expect(result.y).toBeCloseTo(-1);
  });
});

describe("segmentsIntersect", () => {
  it("returns intersection point for crossing segments", () => {
    // X shape: (-1,0)→(1,0) and (0,-1)→(0,1)
    const hit = segmentsIntersect(
      { x: -1, y: 0 }, { x: 1, y: 0 },
      { x: 0, y: -1 }, { x: 0, y: 1 }
    );
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(0);
    expect(hit!.y).toBeCloseTo(0);
  });

  it("returns null for parallel segments", () => {
    const hit = segmentsIntersect(
      { x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 0, y: 1 }, { x: 1, y: 1 }
    );
    expect(hit).toBeNull();
  });

  it("returns null for collinear overlapping segments", () => {
    const hit = segmentsIntersect(
      { x: 0, y: 0 }, { x: 2, y: 0 },
      { x: 1, y: 0 }, { x: 3, y: 0 }
    );
    expect(hit).toBeNull();
  });

  it("returns null when segments would cross if extended but don't actually cross", () => {
    // T-shape: endpoint of one touches midpoint of other
    const hit = segmentsIntersect(
      { x: 0, y: 0 }, { x: 2, y: 0 },
      { x: 1, y: 0 }, { x: 1, y: 2 }
    );
    expect(hit).toBeNull(); // t=0 on second segment, excluded
  });

  it("returns null when lines cross outside segment bounds", () => {
    const hit = segmentsIntersect(
      { x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 2, y: -1 }, { x: 2, y: 1 }
    );
    expect(hit).toBeNull();
  });

  it("returns null for shared endpoint (adjacent segments)", () => {
    const hit = segmentsIntersect(
      { x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 1, y: 0 }, { x: 2, y: 1 }
    );
    expect(hit).toBeNull(); // t=1 or s=0, both excluded
  });
});
