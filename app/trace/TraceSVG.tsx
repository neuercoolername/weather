"use client";

import { useEffect, useRef, useState } from "react";
import { zoom as d3zoom, zoomIdentity, ZoomTransform, ZoomBehavior } from "d3-zoom";
import { select } from "d3-selection";
import IntersectionDot from "./IntersectionDot";
import IntersectionPanel from "./IntersectionPanel";
import TraceHeader from "./TraceHeader";

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
  images: { id: string; caption: string | null; signedUrl: string }[];
}

interface Props {
  tracePoints: TracePoint[];
  intersections: Intersection[];
  latestWind: { speedKph: number; directionDeg: number } | null;
}

const PANEL_WIDTH_FRACTION = 0.33;
const PAN_DURATION = 400;

export default function TraceSVG({ tracePoints, intersections, latestWind }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // Wire d3-zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const zoom = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 20])
      .on("zoom", (e) => {
        transformRef.current = e.transform;
        setTransform(e.transform);
      });
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

  // Animate pan to center the selected intersection in the visible (non-panel) area
  useEffect(() => {
    if (activeId === null) return;
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;
    const ix = intersections.find((i) => i.id === activeId);
    if (!ix) return;

    const panelWidth = window.innerWidth * PANEL_WIDTH_FRACTION;
    const targetScreenX = (window.innerWidth - panelWidth) / 2;
    const targetScreenY = window.innerHeight / 2;
    const from = transformRef.current;
    const toTx = targetScreenX - ix.x * from.k;
    const toTy = targetScreenY - (-ix.y) * from.k;

    const start = performance.now();
    function step(now: number) {
      const t = Math.min((now - start) / PAN_DURATION, 1);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      select(svg!).call(
        zoom!.transform,
        zoomIdentity
          .translate(from.x + (toTx - from.x) * e, from.y + (toTy - from.y) * e)
          .scale(from.k)
      );
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...intersections].sort((a, b) => a.id - b.id);
  const activeIndex = activeId !== null ? sorted.findIndex((ix) => ix.id === activeId) : -1;
  const prevId = activeIndex > 0 ? sorted[activeIndex - 1].id : null;
  const nextId = activeIndex !== -1 && activeIndex < sorted.length - 1 ? sorted[activeIndex + 1].id : null;

  const activeIntersection = intersections.find((ix) => ix.id === activeId) ?? null;
  const hoveredIntersection = intersections.find((ix) => ix.id === hoveredId) ?? null;

  const tracePath = tracePoints.length < 2 ? "" : tracePoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${-p.y}`)
    .join(" ");

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <TraceHeader
        latestWind={latestWind}
        hoveredIntersection={hoveredIntersection}
        activeIntersection={activeIntersection}
      />

      <svg
        ref={svgRef}
        className="w-full h-full"
        onClick={() => setActiveId(null)}
      >
        {/* Content layer — scales and pans with zoom */}
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <path
            d={tracePath}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            strokeLinejoin="round"
            strokeLinecap="round"
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

      {activeIntersection && (
        <IntersectionPanel
          intersection={activeIntersection}
          onClose={() => setActiveId(null)}
          onPrev={prevId !== null ? () => setActiveId(prevId) : null}
          onNext={nextId !== null ? () => setActiveId(nextId) : null}
        />
      )}
    </div>
  );
}
