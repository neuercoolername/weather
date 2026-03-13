interface Props {
  sx: number;
  sy: number;
  isActive: boolean;
  isHovered: boolean;
  onClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function IntersectionDot({
  sx,
  sy,
  isActive,
  isHovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  return (
    <g>
      <circle
        cx={sx}
        cy={sy}
        r={20}
        fill="transparent"
        className="cursor-pointer"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
      <circle
        cx={sx}
        cy={sy}
        r={isHovered ? 10 : 8}
        fill="currentColor"
        opacity={isActive ? 1 : 0.5}
        style={{ transition: "r 0.1s, opacity 0.1s" }}
        pointerEvents="none"
      />
    </g>
  );
}
