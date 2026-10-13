// Imperative breathing loop for the crossing marks — the "external system" a React
// effect connects to, in the same shape as trace-camera.ts. It owns one rAF loop for
// every breathing mark and writes each ring's scale directly, so the animation never
// travels through React state and the camera can keep re-rendering underneath it.
//
// Rings are unit-radius paths scaled to their radius. React sets the resting scale;
// this overwrites it each frame. Under prefers-reduced-motion the loop never starts,
// which leaves exactly that resting radius on screen — the static frame.
//
// Construction touches nothing, so it is safe to create during render: rings register
// through their callback refs, which React attaches before any effect has run. Only
// start() — called from an effect — reaches for the document and the frame loop.

import { breathingRadius, type TraceMarkParams } from "@/lib/domain/trace-marks";

export interface MarkBreathing {
  /**
   * Animate this ring around `radius` (resting, in screen px, already including any
   * hover/active growth), offset by `phase` so marks don't pulse in unison.
   * Returns the untrack — shaped to be a React callback ref's cleanup.
   */
  track(el: SVGGraphicsElement, radius: number, phase: number): () => void;
  /** Run the loop (while marks are tracked and the tab is visible). Returns the stop. */
  start(): () => void;
}

export function createMarkBreathing(params: TraceMarkParams): MarkBreathing {
  const marks = new Map<SVGGraphicsElement, { radius: number; phase: number }>();
  let started = false;
  let raf = 0;
  let startedAt = 0;

  const draw = (now: number) => {
    const seconds = (now - startedAt) / 1000;
    for (const [el, { radius, phase }] of marks) {
      el.setAttribute(
        "transform",
        `scale(${breathingRadius(radius, seconds, phase, params)})`
      );
    }
  };

  const step = (now: number) => {
    draw(now);
    raf = requestAnimationFrame(step);
  };

  // One rule for whether the loop runs, re-checked whenever any input to it changes.
  // No point animating nothing, or a tab nobody is looking at.
  const sync = () => {
    const shouldRun = started && marks.size > 0 && !document.hidden;
    if (shouldRun && !raf) {
      raf = requestAnimationFrame(step);
    } else if (!shouldRun && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  return {
    track(el, radius, phase) {
      marks.set(el, { radius, phase });
      sync();
      return () => {
        marks.delete(el);
        sync();
      };
    },

    start() {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        return () => {};
      }
      started = true;
      startedAt = performance.now();
      document.addEventListener("visibilitychange", sync);
      sync();
      return () => {
        started = false;
        document.removeEventListener("visibilitychange", sync);
        sync();
      };
    },
  };
}
