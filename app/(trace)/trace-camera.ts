// Imperative d3-zoom camera for the trace — the "external system" a React effect
// connects to. Owns zoom setup, initial fit, and animated pan, with guaranteed
// teardown (listeners + any running animation). Fit math is the pure lib/trace.

import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import { select } from "d3-selection";
import { computeFitTransform } from "@/lib/domain/trace-viewport";
import { MAX_SCALE } from "@/lib/domain/trace-marks";

const PAN_DURATION = 400;
const easeInOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export interface TraceCamera {
  /** The scale at which all points fit the current viewport, without moving the
   *  camera. Everything else is expressed relative to this. */
  fitScale(points: { x: number; y: number }[], padding: number): number | null;
  /** Fit all points into the current viewport (instant). Returns the fit scale. */
  fit(points: { x: number; y: number }[], padding: number): number | null;
  /** Animate from the current transform to `target`. Cancels any in-flight animation. */
  animateTo(target: ZoomTransform, opts?: { duration?: number }): void;
  destroy(): void;
}

export function createTraceCamera(
  svg: SVGSVGElement,
  onTransform: (t: ZoomTransform) => void
): TraceCamera {
  let current: ZoomTransform = zoomIdentity;
  let raf = 0;

  // The lower bound is set from the fit scale in fit(), not fixed here: the fitted
  // scale is data-dependent (0.072 on the real trace, and falling as the trace grows),
  // so a hardcoded floor sits *above* it. fit() reaches the view through zoom.transform,
  // which bypasses the extent — but the first wheel event would then clamp the scale up
  // and the whole trace could never be framed again.
  const zoom = d3zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, MAX_SCALE])
    .on("zoom", (e) => {
      current = e.transform;
      onTransform(e.transform);
    });

  const sel = select(svg);
  sel.call(zoom);

  const apply = (t: ZoomTransform) => sel.call(zoom.transform, t);

  // Measuring the fit is also what sets the zoom floor, so the two can never disagree.
  const computeFit = (points: { x: number; y: number }[], padding: number) => {
    const rect = svg.getBoundingClientRect();
    const t = computeFitTransform(
      points,
      { width: rect.width, height: rect.height },
      padding
    );
    if (!t) return null;
    // Let the viewer pull back slightly past the fitted view, never less far than it.
    zoom.scaleExtent([t.k * 0.9, MAX_SCALE]);
    return t;
  };

  return {
    fitScale(points, padding) {
      return computeFit(points, padding)?.k ?? null;
    },

    fit(points, padding) {
      const t = computeFit(points, padding);
      if (!t) return null;
      apply(zoomIdentity.translate(t.x, t.y).scale(t.k));
      return t.k;
    },

    animateTo(target, opts) {
      if (raf) cancelAnimationFrame(raf);
      const from = current;
      const duration = opts?.duration ?? PAN_DURATION;
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const e = easeInOutQuad(p);
        apply(
          zoomIdentity
            .translate(from.x + (target.x - from.x) * e, from.y + (target.y - from.y) * e)
            .scale(from.k + (target.k - from.k) * e)
        );
        raf = p < 1 ? requestAnimationFrame(step) : 0;
      };
      raf = requestAnimationFrame(step);
    },

    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      sel.on(".zoom", null); // remove d3-zoom's wheel/drag listeners
    },
  };
}
