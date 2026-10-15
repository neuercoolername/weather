"use client";

import { useState, type CSSProperties, type SVGProps } from "react";
import type { RingShape } from "@/lib/domain/mark-shape";
import { ringLoopPhases, type RingLoopTiming } from "@/lib/domain/ring-loop";

/**
 * A pen drawing `ring`, holding it, fading it, then drawing it again — for as long as it
 * is mounted. The cycle is two chained CSS animations (globals.css, `.ring-loader`); the
 * fade's end bumps the key, which restarts them. Pass a new `ring` from `onCycle` to have
 * the next pass draw a different one. Under reduced motion the ring just stands, whole.
 */
export default function DrawnRingLoop({
  ring,
  timing,
  paused = false,
  onCycle,
  style,
  ...pathProps
}: {
  ring: RingShape;
  timing: RingLoopTiming;
  /** Freeze the pen where it is, e.g. while a parent fades the ring out. */
  paused?: boolean;
  /** Called as each pass finishes fading, just before the next one starts. */
  onCycle?: () => void;
} & Omit<SVGProps<SVGPathElement>, "d" | "pathLength" | "onAnimationEnd">) {
  const [n, setN] = useState(0);
  const { drawMs, fadeDelayMs, fadeMs } = ringLoopPhases(ring.turns, timing);

  return (
    <path
      key={n}
      d={ring.d}
      pathLength={1}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      {...pathProps}
      className="ring-loader"
      style={
        {
          ...style,
          "--ring-draw": `${drawMs}ms`,
          "--ring-fade": `${fadeMs}ms`,
          "--ring-fade-delay": `${fadeDelayMs}ms`,
          animationPlayState: paused ? "paused" : "running",
        } as CSSProperties
      }
      onAnimationEnd={(e) => {
        if (e.animationName !== "ring-loader-fade") return;
        onCycle?.();
        setN((k) => k + 1);
      }}
    />
  );
}
