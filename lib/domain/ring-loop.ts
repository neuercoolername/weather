// Timing for a pen drawing a ring on a loop (pure / no DOM): it draws, holds the
// finished ring, fades it, then starts again. Drawn by components/DrawnRingLoop.tsx.

export interface RingLoopTiming {
  /** time the pen takes for one full turn, in ms; a ring's draw time scales with its sweep */
  msPerTurn: number;
  /** pause on the finished ring before it fades, in ms */
  holdMs: number;
  /** fade-out of the finished ring, in ms */
  fadeMs: number;
}

/** One pass of the loop for a ring that goes `turns` times round, in ms. */
export function ringLoopPhases(turns: number, timing: RingLoopTiming) {
  const drawMs = turns * timing.msPerTurn;
  return { drawMs, fadeDelayMs: drawMs + timing.holdMs, fadeMs: timing.fadeMs };
}
