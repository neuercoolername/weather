// The hand-drawn ring each crossing wears, drawn with Math.random the first time it is
// asked for and then kept for the life of the page — a new hand on every load, but a
// ring never changes shape under the viewer while they zoom.
//
// The server cannot know those random shapes, so the server render and the first client
// render both draw the plain unit circle; the rings switch to their hand-drawn paths once
// the page has hydrated.

import { useCallback, useSyncExternalStore } from "react";
import {
  handDrawnRingPath,
  UNIT_CIRCLE_PATH,
  type RingShapeParams,
} from "@/lib/domain/mark-shape";

const cache = new WeakMap<RingShapeParams, Map<number, string>>();

function ringShapeFor(id: number, params: RingShapeParams): string {
  let shapes = cache.get(params);
  if (!shapes) {
    shapes = new Map();
    cache.set(params, shapes);
  }
  let d = shapes.get(id);
  if (d === undefined) {
    d = handDrawnRingPath(Math.random, params);
    shapes.set(id, d);
  }
  return d;
}

const subscribeNever = () => () => {};

/** Crossing id → unit-radius ring path; the unit circle until the page has hydrated. */
export function useRingShapes(params: RingShapeParams): (id: number) => string {
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  return useCallback(
    (id: number) => (hydrated ? ringShapeFor(id, params) : UNIT_CIRCLE_PATH),
    [hydrated, params]
  );
}
