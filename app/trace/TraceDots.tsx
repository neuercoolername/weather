import type { ZoomTransform } from "d3-zoom";
import { projectToScreen } from "@/lib/camera";
import IntersectionDot from "./IntersectionDot";

interface DotPoint {
  id: number;
  x: number;
  y: number;
}

// The interactive dots layer: one hit-dot per text-bearing intersection,
// projected into screen space under the current zoom transform.
export default function TraceDots({
  points,
  transform,
  activeId,
  hoveredId,
  onActivate,
  onHover,
}: {
  points: DotPoint[];
  transform: ZoomTransform;
  activeId: number | null;
  hoveredId: number | null;
  onActivate: (id: number) => void;
  onHover: (id: number | null) => void;
}) {
  return (
    <g>
      {points.map((ix) => {
        const { sx, sy } = projectToScreen(ix, transform);
        return (
          <IntersectionDot
            key={ix.id}
            sx={sx}
            sy={sy}
            isActive={activeId === ix.id}
            isHovered={hoveredId === ix.id}
            onClick={(e) => {
              e.stopPropagation();
              onActivate(ix.id);
            }}
            onMouseEnter={() => onHover(ix.id)}
            onMouseLeave={() => onHover(null)}
          />
        );
      })}
    </g>
  );
}
