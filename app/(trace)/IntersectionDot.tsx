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
  /** breathing offset; carried on the element so the rAF controller can find it */
  phase: number;
  onClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// One mark on the trace. The ring is a unit-radius path scaled to its radius, with a
// non-scaling stroke so its weight stays in screen px. While hovered or open, that scale
// is overwritten every frame by mark-breathing.ts, which locates the ring by the data
// attributes below — React owns the resting value, the controller owns the breath. A
// resting mark carries no data attributes, so the controller never touches it.
export default function IntersectionDot({
  sx,
  sy,
  radius,
  shape,
  strokeWidth,
  hitRadius,
  breathing,
  phase,
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
        data-mark-radius={breathing ? radius : undefined}
        data-mark-phase={breathing ? phase : undefined}
      />
    </g>
  );
}
