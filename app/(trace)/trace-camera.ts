// Imperative d3-zoom camera for the trace — the "external system" a React effect
// connects to. Owns zoom setup, fitting to the viewport as it resizes, and animated pans,
// with guaranteed teardown (listeners, observer, any running animation). Fit and centring
// math is the pure lib/domain/trace-viewport.

import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import { select } from "d3-selection";
import { computeCenterTransform, computeFitTransform } from "@/lib/domain/trace-viewport";
import { MAX_SCALE } from "@/lib/domain/trace-marks";

const PAN_DURATION = 400;
const easeInOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

type Point = { x: number; y: number };

export interface CenterOptions {
  /** target scale; defaults to the current one */
  k?: number;
  /** screen px covered on the right (by a panel), so "centre" means the visible part */
  obscuredRight: number;
  /** ms; 0 jumps */
  duration?: number;
}

export interface TraceCamera {
  /**
   * Keep the view fitted to `points` as the viewport resizes, until the viewer takes the
   * camera over; after that only re-measure. Reports the fit scale each time — everything
   * else is expressed relative to it. On the first fit, `firstFocus` may name a point to
   * open centred on instead (a shared link). Returns the unsubscribe.
   */
  watchViewport(
    points: Point[],
    padding: number,
    opts: {
      onFitScale: (k: number | null) => void;
      firstFocus?: () => { point: Point; obscuredRight: number } | null;
    }
  ): () => void;
  /** Pan (and optionally zoom) so `point` sits centred in the unobscured part of the view. */
  centerTo(point: Point, opts: CenterOptions): void;
  destroy(): void;
}

export function createTraceCamera(
  svg: SVGSVGElement,
  onTransform: (t: ZoomTransform) => void
): TraceCamera {
  let current: ZoomTransform = zoomIdentity;
  let raf = 0;
  // Whether the viewer has taken control of the camera — by wheel or drag, or by
  // asking to be taken somewhere. Until then a resize re-fits; afterwards it leaves
  // their view alone.
  let userMoved = false;

  // The lower bound is set from the fit scale in computeFit(), not fixed here: the fitted
  // scale is data-dependent (0.072 on the real trace, and falling as the trace grows),
  // so a hardcoded floor sits *above* it. fit reaches the view through zoom.transform,
  // which bypasses the extent — but the first wheel event would then clamp the scale up
  // and the whole trace could never be framed again.
  const zoom = d3zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, MAX_SCALE])
    .on("zoom", (e) => {
      // Only a real input carries a sourceEvent; our own transforms don't.
      if (e.sourceEvent) userMoved = true;
      current = e.transform;
      onTransform(e.transform);
    });

  const sel = select(svg);
  sel.call(zoom);

  const apply = (t: ZoomTransform) => sel.call(zoom.transform, t);

  // Measuring the fit is also what sets the zoom floor, so the two can never disagree.
  const computeFit = (points: Point[], padding: number) => {
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

  const fit = (points: Point[], padding: number) => {
    const t = computeFit(points, padding);
    if (!t) return null;
    apply(zoomIdentity.translate(t.x, t.y).scale(t.k));
    return t.k;
  };

  const animateTo = (target: ZoomTransform, duration = PAN_DURATION) => {
    if (raf) cancelAnimationFrame(raf);
    // Zero means "be there now"; easing over it would divide 0 by 0.
    if (duration <= 0) {
      raf = 0;
      apply(target);
      return;
    }
    const from = current;
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
  };

  const centerTo = (point: Point, { k, obscuredRight, duration }: CenterOptions) => {
    const rect = svg.getBoundingClientRect();
    const t = computeCenterTransform(
      point,
      { width: rect.width, height: rect.height },
      obscuredRight,
      k ?? current.k
    );
    userMoved = true;
    animateTo(zoomIdentity.translate(t.x, t.y).scale(t.k), duration);
  };

  return {
    watchViewport(points, padding, { onFitScale, firstFocus }) {
      let first = true;
      // Fires once on observe — the initial fit — then on every resize.
      const observer = new ResizeObserver(() => {
        if (userMoved) {
          onFitScale(computeFit(points, padding)?.k ?? null);
          return;
        }
        onFitScale(fit(points, padding));
        if (!first) return;
        first = false;
        // The fit still runs first: it is what measures the scale and sets the floor.
        const focus = firstFocus?.();
        if (focus) centerTo(focus.point, { obscuredRight: focus.obscuredRight, duration: 0 });
      });
      observer.observe(svg);
      return () => observer.disconnect();
    },

    centerTo,

    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      sel.on(".zoom", null); // remove d3-zoom's wheel/drag listeners
    },
  };
}
