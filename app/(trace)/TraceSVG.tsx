"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { zoomIdentity, ZoomTransform } from "d3-zoom";
import { createTraceCamera, type TraceCamera } from "./trace-camera";
import { createMarkBreathing, type MarkBreathing } from "./mark-breathing";
import { computeCenterTransform } from "@/lib/domain/trace-viewport";
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
import TraceDots from "./TraceDots";
import IntersectionPanel from "./IntersectionPanel";
import TraceHeader from "./TraceHeader";
import AboutButton from "./AboutButton";
import AboutPanel from "./AboutPanel";
import { DEFAULT_ABOUT_PARAMS } from "@/lib/domain/about";
import type { WindField } from "@/lib/domain/wind-field";
import type { TracePoint } from "@/lib/server/data/trace-points";
import type { TraceIntersection } from "@/lib/server/data/intersections";
import { hasContent } from "@/lib/domain/intersection-content";
import { getNeighbourIds } from "@/lib/domain/trace-neighbours";
import { toSvgPolyline } from "@/lib/domain/trace-svg-path";
import { parseTracePath, traceHref, type TraceView } from "@/lib/domain/trace-route";

interface Props {
  tracePoints: TracePoint[];
  intersections: TraceIntersection[];
  windField: WindField | null;
  /** this load's Beaufort phrase as headline text — shown whenever no crossing is */
  phrase: string;
  /** the About panel's meta line, formatted on the server */
  aboutMeta: string;
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
  phrase,
  aboutMeta,
  params: paramOverrides,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const aboutButtonRef = useRef<HTMLButtonElement>(null);
  const cameraRef = useRef<TraceCamera | null>(null);
  const breathingRef = useRef<MarkBreathing | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  // Whether the viewer has taken control of the camera. Until they have, a window
  // resize re-fits; afterwards it leaves their view alone.
  const userMovedRef = useRef(false);
  // Whether the open panel's history entry is one this page pushed. Closing then goes
  // Back to the entry before it; a panel reached by a shared link has no such entry.
  const pushedRef = useRef(false);
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

  // Breathing marks — a second external system, recreated only if the feel changes.
  useEffect(() => {
    const breathing = createMarkBreathing(params);
    breathingRef.current = breathing;
    return () => {
      breathing.destroy();
      breathingRef.current = null;
    };
  }, [params]);

  // ── Derived from props + URL ─────────────────────────────────────────────────
  const visibleIntersections = intersections.filter((ix) =>
    hasContent(ix.text)
  );
  // The path is the selection: `/12` is crossing #12 open, `/about` the About panel.
  // Only one panel at a time falls out of that — a path names one view.
  const view = parseTracePath(usePathname());
  const activeId =
    view.kind === "note" && visibleIntersections.some((ix) => ix.id === view.id)
      ? view.id
      : null;
  const aboutOpen = view.kind === "about";
  const panelOpen = activeId !== null || aboutOpen;
  // What a shared link opened on, for the first fit to centre on instead.
  const [initialActiveId] = useState(activeId);
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

  // Hand the current rings to the breathing loop. Re-runs whenever anything that
  // moves or resizes a ring changes; the controller finds them by data attribute.
  useEffect(() => {
    const svg = svgRef.current;
    const breathing = breathingRef.current;
    if (!svg || !breathing) return;
    const rings = svg.querySelectorAll<SVGGraphicsElement>("[data-mark-radius]");
    breathing.setMarks(
      Array.from(rings).map((el) => ({
        el,
        radius: Number(el.dataset.markRadius),
        phase: Number(el.dataset.markPhase),
      }))
    );
  }, [transform, activeId, hoveredKey, params, visibleIntersections.length]);

  // ── Camera ───────────────────────────────────────────────────────────────────
  // Pan the selected intersection to the centre of the visible (non-panel) area.
  // Called from the handlers below rather than an effect: this happens because the
  // user selected something, not because the component rendered.
  const centerOn = useCallback(
    (id: number, duration?: number) => {
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
      camera.animateTo(zoomIdentity.translate(x, y).scale(k), { duration });
    },
    [intersections]
  );

  // Subscribe to the viewport's size. The observer fires once on observe, which is
  // the initial fit; afterwards it re-fits on resize, but only while the viewer
  // hasn't taken the camera over — otherwise it would yank them out of their view.
  // The fit scale still has to be re-measured either way, since it depends on the
  // viewport as well as on the data. A shared link to a crossing opens centred on it:
  // the fit still runs first, since it is what measures the scale and sets the floor.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(() => {
      const camera = cameraRef.current;
      if (!camera) return;
      if (userMovedRef.current) {
        setKFit(camera.fitScale(tracePoints, PADDING));
        return;
      }
      setKFit(camera.fit(tracePoints, PADDING));
      if (initialActiveId !== null) centerOn(initialActiveId, 0);
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [tracePoints, initialActiveId, centerOn]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  // Written straight to the History API rather than through the router: a router
  // navigation would re-run the server page — the whole trace and fresh image URLs —
  // for what is only a change of panel. Next keeps usePathname in step with both.
  //
  // Opening from the bare trace pushes, so Back closes; moving between panels replaces,
  // so Back never steps through every crossing visited.
  const navigate = useCallback((to: TraceView, mode: "push" | "replace") => {
    if (mode === "push") {
      window.history.pushState(null, "", traceHref(to));
      pushedRef.current = true;
    } else {
      window.history.replaceState(null, "", traceHref(to));
    }
  }, []);

  const closePanel = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    } else {
      navigate({ kind: "trace" }, "replace");
    }
  }, [navigate]);

  // Back/Forward land on an entry this page didn't just push, and should travel to a
  // crossing the way a click does.
  useEffect(() => {
    const onPopState = () => {
      pushedRef.current = false;
      const to = parseTracePath(window.location.pathname);
      if (to.kind === "note") centerOn(to.id);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [centerOn]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  // These stay stable across zoom frames (transform isn't a dependency), so the
  // memoized header and panel don't re-render as the camera moves.
  const selectId = useCallback(
    (id: number) => {
      if (activeId === id) {
        closePanel();
        return;
      }
      navigate({ kind: "note", id }, panelOpen ? "replace" : "push");
      centerOn(id);
    },
    [activeId, panelOpen, closePanel, navigate, centerOn]
  );

  // A mark can stand for several crossings, so what a click means depends on whether
  // zooming can take the group apart — openAction decides, and it is pure.
  const handleActivate = useCallback(
    (group: MarkGroup<TraceIntersection>) => {
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

  const handleHoverGroup = useCallback((key: number | null) => setHoveredKey(key), []);
  const handleClose = useCallback(() => {
    if (panelOpen) closePanel();
  }, [panelOpen, closePanel]);
  const handleToggleAbout = useCallback(() => {
    if (aboutOpen) closePanel();
    else navigate({ kind: "about" }, panelOpen ? "replace" : "push");
  }, [aboutOpen, panelOpen, closePanel, navigate]);
  const handleCloseAbout = useCallback(() => {
    if (aboutOpen) closePanel();
  }, [aboutOpen, closePanel]);

  const handlePrev = useCallback(() => {
    if (prevId === null) return;
    navigate({ kind: "note", id: prevId }, "replace");
    centerOn(prevId);
  }, [prevId, navigate, centerOn]);
  const handleNext = useCallback(() => {
    if (nextId === null) return;
    navigate({ kind: "note", id: nextId }, "replace");
    centerOn(nextId);
  }, [nextId, navigate, centerOn]);

  return (
    <div className="relative w-full h-dvh overflow-hidden">
      <TraceHeader windField={windField} text={headline} />

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
        meta={aboutMeta}
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
      />
    </div>
  );
}
