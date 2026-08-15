// Imperative d3-zoom camera for the trace — the "external system" a React effect
// connects to. Owns zoom setup, initial fit, and animated pan, with guaranteed
// teardown (listeners + any running animation). Fit math is the pure lib/trace.

import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import { select } from "d3-selection";
import { computeFitTransform } from "@/lib/camera";

const PAN_DURATION = 400;
const easeInOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export interface TraceCamera {
  /** Fit all points into the current viewport (instant). */
  fit(points: { x: number; y: number }[], padding: number): void;
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

  const zoom = d3zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 20])
    .on("zoom", (e) => {
      current = e.transform;
      onTransform(e.transform);
    });

  const sel = select(svg);
  sel.call(zoom);

  const apply = (t: ZoomTransform) => sel.call(zoom.transform, t);

  return {
    fit(points, padding) {
      const rect = svg.getBoundingClientRect();
      const t = computeFitTransform(
        points,
        { width: rect.width, height: rect.height },
        padding
      );
      if (!t) return;
      apply(zoomIdentity.translate(t.x, t.y).scale(t.k));
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
