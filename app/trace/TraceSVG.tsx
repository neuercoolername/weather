"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { zoomIdentity, ZoomTransform } from "d3-zoom";
import { createTraceCamera, type TraceCamera } from "./traceCamera";
import TraceDots from "./TraceDots";
import IntersectionPanel from "./IntersectionPanel";
import TraceHeader from "./TraceHeader";
import type { WindField } from "@/lib/wind-field";

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
  windField: WindField | null;
}

const PANEL_WIDTH_FRACTION = 0.33;
const MOBILE_BREAKPOINT = 768; // matches Tailwind's `md`
const PADDING = 60;

export default function TraceSVG({ tracePoints, intersections, windField }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cameraRef = useRef<TraceCamera | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // Camera (d3-zoom) — one external-system instance for the component's life.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const camera = createTraceCamera(svg, (t) => {
      transformRef.current = t;
      setTransform(t);
    });
    cameraRef.current = camera;
    return () => {
      camera.destroy();
      cameraRef.current = null;
    };
  }, []);

  // Fit the trace to the viewport (once tracePoints are available).
  useEffect(() => {
    cameraRef.current?.fit(tracePoints, PADDING);
  }, [tracePoints]);

  // Pan the selected intersection to the centre of the visible (non-panel) area.
  useEffect(() => {
    if (activeId === null) return;
    const camera = cameraRef.current;
    const ix = intersections.find((i) => i.id === activeId);
    if (!camera || !ix) return;

    // On mobile the detail view covers the full screen, so centre the whole viewport.
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    const panelWidth = isMobile ? 0 : window.innerWidth * PANEL_WIDTH_FRACTION;
    const targetScreenX = (window.innerWidth - panelWidth) / 2;
    const targetScreenY = window.innerHeight / 2;
    const from = transformRef.current;
    const toTx = targetScreenX - ix.x * from.k;
    const toTy = targetScreenY - -ix.y * from.k;
    camera.animateTo(zoomIdentity.translate(toTx, toTy).scale(from.k));
  }, [activeId, intersections]);

  // Stable handlers so the memoized header/panel/dots don't re-render every zoom frame.
  const handleActivate = useCallback(
    (id: number) => setActiveId((prev) => (prev === id ? null : id)),
    []
  );
  const handleHover = useCallback((id: number | null) => setHoveredId(id), []);
  const handleClose = useCallback(() => setActiveId(null), []);

  const textIntersections = intersections.filter((ix) => ix.text?.trim());
  const sorted = [...textIntersections].sort((a, b) => a.id - b.id);
  const activeIndex = activeId !== null ? sorted.findIndex((ix) => ix.id === activeId) : -1;
  const prevId = activeIndex > 0 ? sorted[activeIndex - 1].id : null;
  const nextId =
    activeIndex !== -1 && activeIndex < sorted.length - 1 ? sorted[activeIndex + 1].id : null;

  const handlePrev = useCallback(() => {
    if (prevId !== null) setActiveId(prevId);
  }, [prevId]);
  const handleNext = useCallback(() => {
    if (nextId !== null) setActiveId(nextId);
  }, [nextId]);

  const activeIntersection = intersections.find((ix) => ix.id === activeId) ?? null;
  const hoveredIntersection = intersections.find((ix) => ix.id === hoveredId) ?? null;

  const tracePath =
    tracePoints.length < 2
      ? ""
      : tracePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${-p.y}`).join(" ");

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <TraceHeader
        windField={windField}
        hoveredIntersection={hoveredIntersection}
        activeIntersection={activeIntersection}
      />

      <svg ref={svgRef} className="w-full h-full" onClick={handleClose}>
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

        {/* UI layer — interactive dots at fixed screen-pixel size */}
        <TraceDots
          points={textIntersections}
          transform={transform}
          activeId={activeId}
          hoveredId={hoveredId}
          onActivate={handleActivate}
          onHover={handleHover}
        />
      </svg>

      {activeIntersection && (
        <IntersectionPanel
          intersection={activeIntersection}
          onClose={handleClose}
          onPrev={prevId !== null ? handlePrev : null}
          onNext={nextId !== null ? handleNext : null}
        />
      )}
    </div>
  );
}
