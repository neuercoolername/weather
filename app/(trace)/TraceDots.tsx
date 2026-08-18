"use client";

import { useState } from "react";
import {
  breathingPhase,
  groupRadius,
  type MarkGroup,
  type MarkMetrics,
  type TraceMarkParams,
} from "@/lib/domain/trace-marks";
import type { IntersectionWithImages } from "@/lib/server/data/intersections";
import IntersectionDot from "./IntersectionDot";

// The interactive marks layer. One element per *group*, not per intersection:
// where crossings crowd together they collapse into a single ring enclosing the
// group's footprint, so a mark can stand for several crossings. Grouping and the
// sizing curve are pure (lib/domain/trace-marks); this only draws the result.
export default function TraceDots({
  groups,
  metrics,
  params,
  activeId,
  onActivate,
  onHover,
}: {
  groups: MarkGroup<IntersectionWithImages>[];
  metrics: MarkMetrics;
  params: TraceMarkParams;
  activeId: number | null;
  onActivate: (group: MarkGroup<IntersectionWithImages>) => void;
  onHover: (id: number | null) => void;
}) {
  // Which ring the cursor is on. Local because it only changes how a ring is drawn —
  // the header is told about a *crossing*, and only when the ring holds exactly one.
  const [hoveredKey, setHoveredKey] = useState<number | null>(null);

  return (
    <g>
      {groups.map((group) => {
        const key = group.members.reduce((a, b) => (b.id < a.id ? b : a)).id;
        const isActive = group.members.some((m) => m.id === activeId);
        const isHovered = hoveredKey === key;

        const resting = groupRadius(group, metrics.markSize);
        const growth = isActive
          ? params.activeGrowth
          : isHovered
            ? params.hoverGrowth
            : 1;
        const stroke = metrics.markStroke * (isActive ? params.activeStrokeRatio : 1);

        return (
          <IntersectionDot
            key={key}
            sx={group.cx}
            sy={group.cy}
            radius={resting * growth}
            strokeWidth={stroke}
            hitRadius={Math.max(params.hitRadius, resting)}
            phase={breathingPhase(group.members[0].tracePointA.snapshot.fetchedAt, params)}
            onClick={(e) => {
              e.stopPropagation();
              onActivate(group);
            }}
            onMouseEnter={() => {
              setHoveredKey(key);
              onHover(group.members.length === 1 ? group.members[0].id : null);
            }}
            onMouseLeave={() => {
              setHoveredKey(null);
              onHover(null);
            }}
          />
        );
      })}
    </g>
  );
}
