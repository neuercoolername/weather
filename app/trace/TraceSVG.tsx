"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { zoomIdentity, ZoomTransform } from "d3-zoom";
import { createTraceCamera, type TraceCamera } from "./traceCamera";
import { computeCenterTransform } from "@/lib/camera";
import TraceDots from "./TraceDots";
import IntersectionPanel from "./IntersectionPanel";
import TraceHeader from "./TraceHeader";
import type { WindField } from "@/lib/wind-field";
import type { TracePoint } from "@/lib/data/trace-points";
import type { IntersectionWithImages } from "@/lib/intersections";
import { hasContent } from "@/lib/intersection-content";
import { getNeighbourIds } from "@/lib/neighbours";
import { toSvgPolyline } from "@/lib/svg-path";

interface Props {
  tracePoints: TracePoint[];
  intersections: IntersectionWithImages[];
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

  // ── Derived from props + selection ───────────────────────────────────────────
  const visibleIntersections = intersections.filter((ix) =>
    hasContent(ix.text, ix.images.length)
  );
  const { prevId, nextId } = getNeighbourIds(visibleIntersections, activeId);
  const activeIntersection = intersections.find((ix) => ix.id === activeId) ?? null;
  const hoveredIntersection = intersections.find((ix) => ix.id === hoveredId) ?? null;
  const tracePath = toSvgPolyline(tracePoints);

  // ── Camera ───────────────────────────────────────────────────────────────────
  // Pan the selected intersection to the centre of the visible (non-panel) area.
  // Called from the handlers below rather than an effect: this happens because the
  // user selected something, not because the component rendered.
  const centerOn = useCallback(
    (id: number) => {
      const camera = cameraRef.current;
      const ix = intersections.find((i) => i.id === id);
      if (!camera || !ix) return;
      // On mobile the detail view covers the full screen, so centre the whole viewport.
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      const panelWidth = isMobile ? 0 : window.innerWidth * PANEL_WIDTH_FRACTION;
      const { x, y, k } = computeCenterTransform(
        ix,
        { width: window.innerWidth, height: window.innerHeight },
        panelWidth,
        transformRef.current.k
      );
      camera.animateTo(zoomIdentity.translate(x, y).scale(k));
    },
    [intersections]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────
  // These stay stable across zoom frames (transform isn't a dependency), so the
  // memoized header and panel don't re-render as the camera moves.
  const handleActivate = useCallback(
    (id: number) => {
      const next = activeId === id ? null : id;
      setActiveId(next);
      if (next !== null) centerOn(next);
    },
    [activeId, centerOn]
  );
  const handleHover = useCallback((id: number | null) => setHoveredId(id), []);
  const handleClose = useCallback(() => setActiveId(null), []);

  const handlePrev = useCallback(() => {
    if (prevId === null) return;
    setActiveId(prevId);
    centerOn(prevId);
  }, [prevId, centerOn]);
  const handleNext = useCallback(() => {
    if (nextId === null) return;
    setActiveId(nextId);
    centerOn(nextId);
  }, [nextId, centerOn]);

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
          points={visibleIntersections}
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
