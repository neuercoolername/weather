// Imperative breathing loop for the crossing marks — the "external system" a React
// effect connects to, in the same shape as trace-camera.ts. It owns one rAF loop for
// every mark on screen and writes the `r` attribute directly, so the animation never
// travels through React state and the camera can keep re-rendering underneath it.
//
// React sets each ring's resting radius; this overwrites it each frame. Under
// prefers-reduced-motion the loop never starts, which leaves exactly that resting
// radius on screen — the static frame.

import { breathingRadius, type TraceMarkParams } from "@/lib/domain/trace-marks";

export interface BreathingMark {
  el: SVGCircleElement;
  /** resting radius in screen px, already including any hover/active growth */
  radius: number;
  /** per-mark offset so they don't pulse in unison */
  phase: number;
}

export interface MarkBreathing {
  /** Replace the set of marks being animated (call after every render). */
  setMarks(marks: BreathingMark[]): void;
  destroy(): void;
}

export function createMarkBreathing(params: TraceMarkParams): MarkBreathing {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  let marks: BreathingMark[] = [];
  let raf = 0;
  let startedAt = 0;

  const draw = (now: number) => {
    const seconds = (now - startedAt) / 1000;
    for (const mark of marks) {
      mark.el.setAttribute(
        "r",
        String(breathingRadius(mark.radius, seconds, mark.phase, params))
      );
    }
  };

  const step = (now: number) => {
    draw(now);
    raf = requestAnimationFrame(step);
  };

  const start = () => {
    if (raf || reduced || marks.length === 0) return;
    if (startedAt === 0) startedAt = performance.now();
    raf = requestAnimationFrame(step);
  };

  const stop = () => {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  // No point animating a tab nobody is looking at.
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVisibility);

  start();

  return {
    setMarks(next) {
      marks = next;
      if (marks.length === 0) stop();
      else if (!document.hidden) start();
    },
    destroy() {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      marks = [];
    },
  };
}
