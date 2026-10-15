import DrawnRingLoop from "@/components/DrawnRingLoop";
import type { RingShape } from "@/lib/domain/mark-shape";
import type { RingLoopTiming } from "@/lib/domain/ring-loop";

interface Props {
  sx: number;
  sy: number;
  /** resting ring radius in screen px, including any hover/active growth */
  radius: number;
  /** the hand-drawn ring at unit radius, scaled up to `radius` */
  shape: RingShape;
  strokeWidth: number;
  hitRadius: number;
  /** whether this ring is hovered or open — only these are redrawn on a loop */
  looping: boolean;
  /** the looping ring's size, as a multiple of `radius` */
  loopScale: number;
  loopTiming: RingLoopTiming;
  onClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// One mark on the trace. The ring is a unit-radius path scaled to its radius, with a
// non-scaling stroke so its weight stays in screen px. While hovered or open, the pen
// redraws that same ring, a little larger, over and over (components/DrawnRingLoop).
// That ring divides its stroke by the scale instead: under a non-scaling stroke the
// browser measures dashes in screen px and ignores pathLength, so the pen would not draw.
export default function IntersectionDot({
  sx,
  sy,
  radius,
  shape,
  strokeWidth,
  hitRadius,
  looping,
  loopScale,
  loopTiming,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const loopRadius = radius * loopScale;
  const pen = { strokeLinecap: "round", strokeLinejoin: "round", pointerEvents: "none" } as const;

  return (
    <g transform={`translate(${sx},${sy})`}>
      <circle
        r={hitRadius}
        fill="transparent"
        className="cursor-pointer"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
      {looping ? (
        <DrawnRingLoop
          ring={shape}
          timing={loopTiming}
          transform={`scale(${loopRadius})`}
          strokeWidth={strokeWidth / loopRadius}
          {...pen}
        />
      ) : (
        <path
          d={shape.d}
          transform={`scale(${radius})`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          {...pen}
        />
      )}
    </g>
  );
}
