interface Props {
  sx: number;
  sy: number;
  /** resting ring radius in screen px, including any hover/active growth */
  radius: number;
  strokeWidth: number;
  hitRadius: number;
  /** breathing offset; carried on the element so the rAF controller can find it */
  phase: number;
  onClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// One mark on the trace. The visible ring's `r` is overwritten every frame by
// mark-breathing.ts, which locates these circles by the data attributes below —
// React owns the resting value, the controller owns the breath.
export default function IntersectionDot({
  sx,
  sy,
  radius,
  strokeWidth,
  hitRadius,
  phase,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  return (
    <g>
      <circle
        cx={sx}
        cy={sy}
        r={hitRadius}
        fill="transparent"
        className="cursor-pointer"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
      <circle
        cx={sx}
        cy={sy}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        pointerEvents="none"
        data-mark-radius={radius}
        data-mark-phase={phase}
      />
    </g>
  );
}
