"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zoomIdentity, ZoomTransform } from "d3-zoom";
import { createTraceCamera, type TraceCamera } from "./trace-camera";
import { createMarkBreathing, type MarkBreathing } from "./mark-breathing";
import { computeCenterTransform } from "@/lib/domain/trace-viewport";
import {
  DEFAULT_TRACE_MARK_PARAMS,
  groupMarks,
  markMetrics,
  openAction,
  type MarkGroup,
  type TraceMarkParams,
} from "@/lib/domain/trace-marks";
import TraceDots from "./TraceDots";
import IntersectionPanel from "./IntersectionPanel";
import TraceHeader from "./TraceHeader";
import type { WindField } from "@/lib/domain/wind-field";
import type { TracePoint } from "@/lib/server/data/trace-points";
import type { IntersectionWithImages } from "@/lib/server/data/intersections";
import { hasContent } from "@/lib/domain/intersection-content";
import { getNeighbourIds } from "@/lib/domain/trace-neighbours";
import { toSvgPolyline } from "@/lib/domain/trace-svg-path";

interface Props {
  tracePoints: TracePoint[];
  intersections: IntersectionWithImages[];
  windField: WindField | null;
  /** override any of the tuned mark/weight values */
  params?: Partial<TraceMarkParams>;
}

const PANEL_WIDTH_FRACTION = 0.33;
const MOBILE_BREAKPOINT = 768; // matches Tailwind's `md`
const PADDING = 60;

export default function TraceSVG({
  tracePoints,
  intersections,
  windField,
  params: paramOverrides,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cameraRef = useRef<TraceCamera | null>(null);
  const breathingRef = useRef<MarkBreathing | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  // Whether the viewer has taken control of the camera. Until they have, a window
  // resize re-fits; afterwards it leaves their view alone.
  const userMovedRef = useRef(false);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [kFit, setKFit] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const params = useMemo(
    () => ({ ...DEFAULT_TRACE_MARK_PARAMS, ...paramOverrides }),
    [paramOverrides]
  );

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

  // Breathing marks — a second external system, recreated only if the feel changes.
  useEffect(() => {
    const breathing = createMarkBreathing(params);
    breathingRef.current = breathing;
    return () => {
      breathing.destroy();
      breathingRef.current = null;
    };
  }, [params]);

  // Subscribe to the viewport's size. The observer fires once on observe, which is
  // the initial fit; afterwards it re-fits on resize, but only while the viewer
  // hasn't taken the camera over — otherwise it would yank them out of their view.
  // The fit scale still has to be re-measured either way, since it depends on the
  // viewport as well as on the data.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(() => {
      const camera = cameraRef.current;
      if (!camera) return;
      setKFit(
        userMovedRef.current
          ? camera.fitScale(tracePoints, PADDING)
          : camera.fit(tracePoints, PADDING)
      );
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [tracePoints]);

  // ── Derived from props + selection ───────────────────────────────────────────
  const visibleIntersections = intersections.filter((ix) =>
    hasContent(ix.text, ix.images.length)
  );
  const { prevId, nextId } = getNeighbourIds(visibleIntersections, activeId);
  const activeIntersection = intersections.find((ix) => ix.id === activeId) ?? null;
  const hoveredIntersection = intersections.find((ix) => ix.id === hoveredId) ?? null;
  const tracePath = toSvgPolyline(tracePoints);

  // Weights and grouping both key off the zoom *relative to the fitted view*, so the
  // mark:trace ratio is fixed and "full scale" stays meaningful as the trace grows.
  const metrics = markMetrics(transform.k, kFit ?? transform.k, params);
  const groups = groupMarks(visibleIntersections, transform, metrics.markSize, params);

  // Hand the current rings to the breathing loop. Re-runs whenever anything that
  // moves or resizes a ring changes; the controller finds them by data attribute.
  useEffect(() => {
    const svg = svgRef.current;
    const breathing = breathingRef.current;
    if (!svg || !breathing) return;
    const circles = svg.querySelectorAll<SVGCircleElement>("[data-mark-radius]");
    breathing.setMarks(
      Array.from(circles).map((el) => ({
        el,
        radius: Number(el.dataset.markRadius),
        phase: Number(el.dataset.markPhase),
      }))
    );
  }, [transform, activeId, hoveredId, params, visibleIntersections.length]);

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
      userMovedRef.current = true;
      camera.animateTo(zoomIdentity.translate(x, y).scale(k));
    },
    [intersections]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────
  // These stay stable across zoom frames (transform isn't a dependency), so the
  // memoized header and panel don't re-render as the camera moves.
  const selectId = useCallback(
    (id: number) => {
      const next = activeId === id ? null : id;
      setActiveId(next);
      if (next !== null) centerOn(next);
    },
    [activeId, centerOn]
  );

  // A mark can stand for several crossings, so what a click means depends on whether
  // zooming can take the group apart — openAction decides, and it is pure.
  const handleActivate = useCallback(
    (group: MarkGroup<IntersectionWithImages>) => {
      const camera = cameraRef.current;
      const action = openAction(group, kFit ?? transformRef.current.k, params);

      if (action.kind === "select") {
        selectId(action.id);
        return;
      }
      if (!camera) return;

      // Open the group: travel to the scale where it first comes apart.
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      const panelWidth =
        activeId !== null && !isMobile ? window.innerWidth * PANEL_WIDTH_FRACTION : 0;
      const { x, y } = computeCenterTransform(
        { x: action.cx, y: action.cy },
        { width: window.innerWidth, height: window.innerHeight },
        panelWidth,
        action.k
      );
      userMovedRef.current = true;
      camera.animateTo(zoomIdentity.translate(x, y).scale(action.k));
    },
    [activeId, kFit, params, selectId]
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

      <svg
        ref={svgRef}
        className="w-full h-full"
        onClick={handleClose}
        onWheelCapture={() => (userMovedRef.current = true)}
        onPointerDownCapture={() => (userMovedRef.current = true)}
      >
        {/* Content layer — scales and pans with zoom. The stroke does not: its width
            comes from the same curve as the marks', so their ratio is fixed. */}
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <path
            d={tracePath}
            fill="none"
            stroke="currentColor"
            strokeWidth={metrics.traceWidth}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>

        {/* UI layer — marks positioned in data space, sized in screen pixels */}
        <TraceDots
          groups={groups}
          metrics={metrics}
          params={params}
          activeId={activeId}
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
