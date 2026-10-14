"use client";

import { useState } from "react";
import {
  DEFAULT_RING_SHAPE_PARAMS,
  handDrawnRing,
  seededRandom,
  type RingShapeParams,
} from "@/lib/domain/mark-shape";
import type { RingLoopTiming } from "@/lib/domain/ring-loop";
import DrawnRingLoop from "./DrawnRingLoop";

export interface LoaderConfig extends RingLoopTiming {
  /** Ring diameter, in px. */
  sizePx: number;
  /** Pen width, in px. */
  strokePx: number;
}

export const LOADER_CONFIG: LoaderConfig = {
  sizePx: 24,
  strokePx: 1.25,
  msPerTurn: 700,
  holdMs: 250,
  fadeMs: 350,
};

// Mostly the looping multi-pass ring, now and then a single overshoot or gap. A closed
// ring is left out: with no pen start or end it reads as a plain circle being traced.
const LOADER_RING_PARAMS: RingShapeParams = {
  ...DEFAULT_RING_SHAPE_PARAMS,
  weights: { multi: 4, overshoot: 1, gap: 1, closed: 0 },
};

// The first ring is seeded so server and client draw the same one; later rings are new hands.
const FIRST_RING_SEED = 7;

const PAD = 1.3;

/**
 * A pen drawing a hand-drawn ring, holding it, fading it, then drawing a different one —
 * for as long as it is mounted.
 */
export default function DrawnRingLoader({
  paused = false,
  config = LOADER_CONFIG,
}: {
  /** Freeze the pen where it is, e.g. while the parent fades the loader out. */
  paused?: boolean;
  config?: LoaderConfig;
}) {
  const [ring, setRing] = useState(() =>
    handDrawnRing(seededRandom(FIRST_RING_SEED), LOADER_RING_PARAMS)
  );
  const unitPx = config.sizePx / 2;

  return (
    <svg
      width={config.sizePx * PAD}
      height={config.sizePx * PAD}
      viewBox={`${-PAD} ${-PAD} ${PAD * 2} ${PAD * 2}`}
      className="overflow-visible"
      aria-hidden
    >
      <DrawnRingLoop
        ring={ring}
        timing={config}
        paused={paused}
        strokeWidth={config.strokePx / unitPx}
        onCycle={() => setRing(handDrawnRing(Math.random, LOADER_RING_PARAMS))}
      />
    </svg>
  );
}
