"use client";

import { useState } from "react";

interface TracePoint {
  id: number;
  x: number;
  y: number;
  snapshot: { fetchedAt: Date };
}

interface Intersection {
  id: number;
  x: number;
  y: number;
  text: string | null;
  tracePointIdA: number;
  tracePointIdB: number;
  tracePointA: { snapshot: { fetchedAt: Date } };
  tracePointB: { snapshot: { fetchedAt: Date } };
}

interface Props {
  tracePoints: TracePoint[];
  intersections: Intersection[];
}

const PADDING = 40;
const DOT_RADIUS = 5;
const HIT_RADIUS = 16;

export default function TraceSVG({ tracePoints, intersections }: Props) {
  const [activeText, setActiveText] = useState<string | null>(null);

  const xs = tracePoints.map((p) => p.x);
  const ys = tracePoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const viewBox = [
    minX - PADDING,
    minY - PADDING,
    maxX - minX + PADDING * 2,
    maxY - minY + PADDING * 2,
  ].join(" ");

  const points = tracePoints.map((p) => `${p.x},${p.y}`).join(" ");

  function handleDotClick(ix: Intersection) {
    setActiveText(activeText === String(ix.id) ? null : String(ix.id));
  }

  return (
    <div className="relative w-full max-w-3xl p-8">
      <svg
        viewBox={viewBox}
        className="w-full h-auto"
        style={{ overflow: "visible" }}
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.6}
        />
        {intersections.map((ix) => (
          <g key={ix.id}>
            <circle
              cx={ix.x}
              cy={ix.y}
              r={HIT_RADIUS}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => handleDotClick(ix)}
            />
            <circle
              cx={ix.x}
              cy={ix.y}
              r={DOT_RADIUS}
              fill="currentColor"
              opacity={activeText === String(ix.id) ? 1 : 0.8}
            />
            {activeText === String(ix.id) && (() => {
              const fmt = (d: Date) =>
                new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const dateLabel = `${fmt(ix.tracePointA.snapshot.fetchedAt)} × ${fmt(ix.tracePointB.snapshot.fetchedAt)}`;
              return (
                <text
                  x={ix.x + DOT_RADIUS + 4}
                  y={ix.y}
                  dominantBaseline="middle"
                  fontSize={8}
                  opacity={0.6}
                >
                  <tspan x={ix.x + DOT_RADIUS + 4} dy="-5">{dateLabel}</tspan>
                  {ix.text && <tspan x={ix.x + DOT_RADIUS + 4} dy="10">{ix.text}</tspan>}
                </text>
              );
            })()}
          </g>
        ))}
      </svg>
    </div>
  );
}
