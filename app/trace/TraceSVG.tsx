"use client";

import { useEffect, useRef, useState } from "react";
import { zoom as d3zoom, zoomIdentity, ZoomTransform, ZoomBehavior } from "d3-zoom";
import { select } from "d3-selection";
import IntersectionDot from "./IntersectionDot";
import IntersectionLabel from "./IntersectionLabel";

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

export default function TraceSVG({ tracePoints, intersections }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // Wire d3-zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const zoom = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 20])
      .on("zoom", (e) => setTransform(e.transform));
    zoomRef.current = zoom;
    select(svg).call(zoom);
  }, []);

  // Initial fit
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current || tracePoints.length === 0) return;
    const { width, height } = svg.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const PADDING = 60;
    const xs = tracePoints.map((p) => p.x);
    const ys = tracePoints.map((p) => -p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const dataW = maxX - minX || 1;
    const dataH = maxY - minY || 1;
    const k = Math.min(
      (width - PADDING * 2) / dataW,
      (height - PADDING * 2) / dataH
    );
    const tx = (width - dataW * k) / 2 - minX * k;
    const ty = (height - dataH * k) / 2 - minY * k;
    select(svg).call(
      zoomRef.current.transform,
      zoomIdentity.translate(tx, ty).scale(k)
    );
  }, []); // tracePoints are stable (server-rendered)

  // Stored coords are Cartesian (y-up). Negate y here to convert to SVG screen convention (y-down).
  const points = tracePoints.map((p) => `${p.x},${-p.y}`).join(" ");
  const activeIntersection = intersections.find((ix) => ix.id === activeId) ?? null;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <svg
        ref={svgRef}
        className="w-full h-full"
        onClick={() => setActiveId(null)}
      >
        {/* Content layer — scales and pans with zoom */}
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.6}
          />
        </g>

        {/* UI layer — dots at fixed screen-pixel size */}
        <g>
          {intersections.map((ix) => {
            const sx = ix.x * transform.k + transform.x;
            const sy = (-ix.y) * transform.k + transform.y;
            return (
              <IntersectionDot
                key={ix.id}
                sx={sx}
                sy={sy}
                isActive={activeId === ix.id}
                isHovered={hoveredId === ix.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveId(activeId === ix.id ? null : ix.id);
                }}
                onMouseEnter={() => setHoveredId(ix.id)}
                onMouseLeave={() => setHoveredId(null)}
              />
            );
          })}
        </g>
      </svg>

      {/* HTML overlay label */}
      {activeIntersection && (() => {
        const sx = activeIntersection.x * transform.k + transform.x;
        const sy = (-activeIntersection.y) * transform.k + transform.y;
        return (
          <IntersectionLabel
            sx={sx}
            sy={sy}
            intersection={activeIntersection}
          />
        );
      })()}
    </div>
  );
}
