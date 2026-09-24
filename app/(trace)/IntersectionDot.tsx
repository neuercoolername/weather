interface Props {
  sx: number;
  sy: number;
  /** resting ring radius in screen px, including any hover/active growth */
  radius: number;
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

// One mark on the trace. While hovered or open, the visible ring's `r` is overwritten
// every frame by mark-breathing.ts, which locates these circles by the data attributes
// below — React owns the resting value, the controller owns the breath. A resting mark
// carries no data attributes, so the controller never touches it and it stays static.
export default function IntersectionDot({
  sx,
  sy,
  radius,
  strokeWidth,
  hitRadius,
  breathing,
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
        data-mark-radius={breathing ? radius : undefined}
        data-mark-phase={breathing ? phase : undefined}
      />
    </g>
  );
}
