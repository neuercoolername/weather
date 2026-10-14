"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { zoomIdentity, ZoomTransform } from "d3-zoom";
import { createTraceCamera, type TraceCamera } from "./_camera/trace-camera";
import { useTraceNavigation } from "./_camera/use-trace-navigation";
import {
  DEFAULT_TRACE_MARK_PARAMS,
  groupKey,
  groupMarks,
  markMetrics,
  openAction,
  type MarkGroup,
  type TraceMarkParams,
} from "@/lib/domain/trace-marks";
import { traceHeadline } from "@/lib/domain/trace-headline";
import TraceDots from "./_marks/TraceDots";
import IntersectionPanel from "./_panel/IntersectionPanel";
import TraceHeader from "./_headline/TraceHeader";
import AboutButton from "./_panel/AboutButton";
import AboutPanel from "./_panel/AboutPanel";
import { DEFAULT_ABOUT_PARAMS } from "@/lib/domain/about";
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
  /** this load's Beaufort phrase as headline text — shown whenever no crossing is */
  phrase: string;
  /** override any of the tuned mark/weight values */
  params?: Partial<TraceMarkParams>;
}

const PANEL_WIDTH_FRACTION = 0.33;
const MOBILE_BREAKPOINT = 768; // matches Tailwind's `md`
const PADDING = 60;

// Screen px an open panel covers on the right, so "centre" means the part still visible.
// On mobile the detail view covers the full screen, so centre the whole viewport.
function panelObscuredWidth(panelOpen: boolean): number {
  if (!panelOpen || window.innerWidth < MOBILE_BREAKPOINT) return 0;
  return window.innerWidth * PANEL_WIDTH_FRACTION;
}

export default function TraceSVG({
  tracePoints,
  intersections,
  windField,
  phrase,
  params: paramOverrides,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const aboutButtonRef = useRef<HTMLButtonElement>(null);
  const cameraRef = useRef<TraceCamera | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [kFit, setKFit] = useState<number | null>(null);
  // The *ring* under the cursor, not a crossing: a ring can hold several.
  const [hoveredKey, setHoveredKey] = useState<number | null>(null);

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

  // Pan a crossing to the centre of the visible (non-panel) area. Called from the
  // handlers below rather than an effect: this happens because the user selected
  // something, not because the component rendered.
  const centerOn = useCallback(
    (id: number) => {
      const ix = intersections.find((i) => i.id === id);
      if (ix) cameraRef.current?.centerTo(ix, { obscuredRight: panelObscuredWidth(true) });
    },
    [intersections]
  );

  // ── Derived from props + URL ─────────────────────────────────────────────────
  // The path is the selection: `/12` is crossing #12 open, `/about` the About panel.
  // Only one panel at a time falls out of that — a path names one view. Back/Forward
  // travel to a crossing the way a click does.
  const { view, show, close } = useTraceNavigation((to) => {
    if (to.kind === "note") centerOn(to.id);
  });
  const visibleIntersections = intersections.filter((ix) =>
    hasContent(ix.text, ix.images.length)
  );
  const activeId =
    view.kind === "note" && visibleIntersections.some((ix) => ix.id === view.id)
      ? view.id
      : null;
  const aboutOpen = view.kind === "about";
  const panelOpen = activeId !== null || aboutOpen;
  const { prevId, nextId } = getNeighbourIds(visibleIntersections, activeId);
  const activeIntersection = intersections.find((ix) => ix.id === activeId) ?? null;
  const tracePath = toSvgPolyline(tracePoints);

  // Weights and grouping both key off the zoom *relative to the fitted view*, so the
  // mark:trace ratio is fixed and "full scale" stays meaningful as the trace grows.
  const metrics = markMetrics(transform.k, kFit ?? transform.k, params);
  const groups = groupMarks(visibleIntersections, transform, metrics.markSize, params);

  // The header names what the cursor is on, else what is open, else nothing. The hovered
  // group is looked up in the *current* groups rather than held in state: grouping is
  // recomputed every render, so a stored group would go stale as the camera moves. Going
  // by key also survives a split — the key still belongs to one of the halves.
  const hoveredGroup = groups.find((g) => groupKey(g).id === hoveredKey) ?? null;
  const headline = hoveredGroup
    ? traceHeadline(groupKey(hoveredGroup), hoveredGroup.members.length - 1, phrase)
    : traceHeadline(activeIntersection, 0, phrase);

  // Keep the camera fitted to the viewport. A shared link to a crossing opens centred on
  // it — read once, on the first fit, not reacted to.
  const firstFocus = useEffectEvent(() =>
    activeIntersection
      ? { point: activeIntersection, obscuredRight: panelObscuredWidth(true) }
      : null
  );
  useEffect(
    () =>
      cameraRef.current?.watchViewport(tracePoints, PADDING, {
        onFitScale: setKFit,
        firstFocus: () => firstFocus(),
      }),
    [tracePoints]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────
  // These stay stable across zoom frames (transform isn't a dependency), so the
  // memoized header and panel don't re-render as the camera moves.
  const selectId = useCallback(
    (id: number) => {
      if (activeId === id) {
        close();
        return;
      }
      show({ kind: "note", id });
      centerOn(id);
    },
    [activeId, close, show, centerOn]
  );

  // A mark can stand for several crossings, so what a click means depends on whether
  // zooming can take the group apart — openAction decides, and it is pure.
  const handleActivate = useCallback(
    (group: MarkGroup<IntersectionWithImages>) => {
      const action = openAction(group, kFit ?? transformRef.current.k, params);
      if (action.kind === "select") {
        selectId(action.id);
        return;
      }
      // Open the group: travel to the scale where it first comes apart.
      cameraRef.current?.centerTo(
        { x: action.cx, y: action.cy },
        { k: action.k, obscuredRight: panelObscuredWidth(panelOpen) }
      );
    },
    [kFit, params, panelOpen, selectId]
  );

  const handleHoverGroup = useCallback((key: number | null) => setHoveredKey(key), []);
  const handleClose = useCallback(() => {
    if (panelOpen) close();
  }, [panelOpen, close]);
  const handleToggleAbout = useCallback(() => {
    if (aboutOpen) close();
    else show({ kind: "about" });
  }, [aboutOpen, close, show]);
  const handleCloseAbout = useCallback(() => {
    if (aboutOpen) close();
  }, [aboutOpen, close]);

  const handlePrev = useCallback(() => {
    if (prevId === null) return;
    show({ kind: "note", id: prevId });
    centerOn(prevId);
  }, [prevId, show, centerOn]);
  const handleNext = useCallback(() => {
    if (nextId === null) return;
    show({ kind: "note", id: nextId });
    centerOn(nextId);
  }, [nextId, show, centerOn]);

  return (
    <div className="relative w-full h-dvh overflow-hidden">
      <TraceHeader windField={windField} text={headline} />

      <svg ref={svgRef} className="w-full h-full" onClick={handleClose}>
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
          onHoverGroup={handleHoverGroup}
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

      <AboutPanel
        open={aboutOpen}
        params={DEFAULT_ABOUT_PARAMS}
        onClose={handleCloseAbout}
        returnFocusRef={aboutButtonRef}
      />
      <AboutButton
        ref={aboutButtonRef}
        open={aboutOpen}
        onToggle={handleToggleAbout}
        params={DEFAULT_ABOUT_PARAMS}
        ringShape={params.ringShape}
        loopTiming={params.loopTiming}
      />
    </div>
  );
}
