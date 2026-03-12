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
}

interface Props {
  tracePoints: TracePoint[];
  intersections: Intersection[];
}

const PADDING = 40;
const DOT_RADIUS = 5;

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

  console.log(intersections)

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
          <circle
            key={ix.id}
            cx={ix.x}
            cy={ix.y}
            r={DOT_RADIUS}
            fill="currentColor"
            opacity={0.8}
            className="cursor-pointer hover:opacity-100"
            onClick={() => handleDotClick(ix)}
          />
        ))}
      </svg>

      {activeText !== null && (
        <div
          className="mt-4 text-sm text-zinc-500 cursor-pointer"
          onClick={() => setActiveText(null)}
        >
          {intersections.find((ix) => String(ix.id) === activeText)?.text ?? "(no note yet)"}
        </div>
      )}
    </div>
  );
}
