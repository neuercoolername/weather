"use client";

import { useState, type CSSProperties } from "react";
import {
  DEFAULT_RING_SHAPE_PARAMS,
  pickRingStyle,
  ringPath,
  ringPoints,
  seededRandom,
  type RingShapeParams,
} from "@/lib/domain/mark-shape";

export interface LoaderConfig {
  /** Ring diameter, in px. */
  sizePx: number;
  /** Pen width, in px. */
  strokePx: number;
  /** Time the pen takes for one full turn, in ms; a ring's draw time scales with its sweep. */
  msPerTurn: number;
  /** Pause on the finished ring before it fades, in ms. */
  holdMs: number;
  /** Fade-out of the finished ring, in ms. */
  fadeMs: number;
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

function drawRing(rand: () => number, n: number) {
  const ring = ringPoints(rand, pickRingStyle(rand(), LOADER_RING_PARAMS.weights), LOADER_RING_PARAMS);
  return { d: ringPath(ring), turns: ring.sweep / (Math.PI * 2), n };
}

const PAD = 1.3;

/**
 * A pen drawing a hand-drawn ring, holding it, fading it, then drawing a different one —
 * for as long as it is mounted. The cycle is two chained CSS animations (globals.css);
 * the fade's end swaps in the next ring, and the key change restarts them.
 */
export default function DrawnRingLoader({
  paused = false,
  config = LOADER_CONFIG,
}: {
  /** Freeze the pen where it is, e.g. while the parent fades the loader out. */
  paused?: boolean;
  config?: LoaderConfig;
}) {
  const [ring, setRing] = useState(() => drawRing(seededRandom(FIRST_RING_SEED), 0));
  const drawMs = ring.turns * config.msPerTurn;
  const unitPx = config.sizePx / 2;

  return (
    <svg
      width={config.sizePx * PAD}
      height={config.sizePx * PAD}
      viewBox={`${-PAD} ${-PAD} ${PAD * 2} ${PAD * 2}`}
      className="overflow-visible"
      aria-hidden
    >
      <path
        key={ring.n}
        d={ring.d}
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth={config.strokePx / unitPx}
        strokeLinecap="round"
        className="ring-loader"
        style={
          {
            "--ring-draw": `${drawMs}ms`,
            "--ring-fade": `${config.fadeMs}ms`,
            "--ring-fade-delay": `${drawMs + config.holdMs}ms`,
            animationPlayState: paused ? "paused" : "running",
          } as CSSProperties
        }
        onAnimationEnd={(e) => {
          if (e.animationName === "ring-loader-fade") setRing(drawRing(Math.random, ring.n + 1));
        }}
      />
    </svg>
  );
}
