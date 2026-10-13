import type { MarkBreathing } from "./mark-breathing";

interface Props {
  sx: number;
  sy: number;
  /** resting ring radius in screen px, including any hover/active growth */
  radius: number;
  /** the hand-drawn ring at unit radius, scaled up to `radius` */
  shape: string;
  strokeWidth: number;
  hitRadius: number;
  /** whether this ring is hovered or open — only these breathe */
  breathing: boolean;
  /** breathing offset, so marks don't pulse in unison */
  phase: number;
  /** registers the ring with the breathing loop while it breathes */
  track: MarkBreathing["track"];
  onClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// One mark on the trace. The ring is a unit-radius path scaled to its radius, with a
// non-scaling stroke so its weight stays in screen px. While hovered or open, that scale
// is overwritten every frame by mark-breathing.ts, which the ring joins through its ref —
// React owns the resting value, the controller owns the breath. A resting mark has no ref,
// so the controller never touches it.
export default function IntersectionDot({
  sx,
  sy,
  radius,
  shape,
  strokeWidth,
  hitRadius,
  breathing,
  phase,
  track,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: Props) {
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
      <path
        d={shape}
        transform={`scale(${radius})`}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
        // Re-attached each render, so the loop always holds the current radius.
        ref={breathing ? (el) => (el ? track(el, radius, phase) : undefined) : undefined}
      />
    </g>
  );
}
