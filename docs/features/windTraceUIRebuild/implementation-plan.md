# Wind Trace UI Rebuild — Implementation Plan

## Context

The current `TraceSVG.tsx` prototype uses a single SVG `viewBox` as the camera. Everything lives in data-coordinate space and scales uniformly, causing unreadable text, drifting click targets, and hit areas that are either too small or too large. This plan describes a rebuild using d3-zoom with a two-layer SVG architecture.

`page.tsx` and all backend files are untouched — props are identical.

---

## Dependencies to add

```bash
npm install d3-zoom d3-selection
npm install -D @types/d3-zoom @types/d3-selection
```

---

## Architecture

A `relative` wrapper div contains:
1. An `<svg>` filling the viewport (ref attached for d3-zoom)
2. An absolutely-positioned HTML `<div>` for the active label (rendered by `IntersectionLabel`)

Inside the SVG, two layers:

**Content layer** — polyline only, scaled and panned with the camera:
```svg
<g transform="translate(tx, ty) scale(k)">
  <polyline ... />
</g>
```

**UI layer** — intersection dots, each positioned in screen space (`sx = x*k + tx`, `sy = y*k + ty`) but sized in screen pixels. Rendered by `IntersectionDot`.

---

## Component breakdown

### `TraceSVG.tsx` — orchestrator

- Owns all state: `transform`, `activeId`, `hoveredId`
- Wires d3-zoom to the SVG ref
- Runs initial fit on mount
- Renders the wrapper, SVG (content + UI layers), and `IntersectionLabel`
- Handles dismiss-on-background-click via `onClick` on the `<svg>`

### `IntersectionDot.tsx` — single dot

Props: `sx`, `sy`, `isActive`, `isHovered`, `onClick`, `onMouseEnter`, `onMouseLeave`

Renders two SVG elements inside a `<g>`:
- Transparent hit circle (`r={20}`) — handles pointer events
- Visual circle (`r={isHovered ? 10 : 8}`, CSS transition, opacity based on active state)

### `IntersectionLabel.tsx` — floating HTML label

Props: `sx`, `sy`, `intersection` (with `tracePointA`, `tracePointB`, `text`)

Renders an absolutely-positioned `<div>` offset from the dot. Contains:
- Date line: `"Mon DD, YYYY × Mon DD, YYYY"` from the two `fetchedAt` values
- Optional text if `intersection.text` is present

---

## State (in `TraceSVG`)

```ts
const svgRef = useRef<SVGSVGElement>(null)
const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>(null)
const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
const [activeId, setActiveId] = useState<number | null>(null)
const [hoveredId, setHoveredId] = useState<number | null>(null)
```

---

## d3-zoom wiring

```ts
useEffect(() => {
  const svg = svgRef.current
  if (!svg) return
  const zoom = d3zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 20])
    .on("zoom", (e) => setTransform(e.transform))
  zoomRef.current = zoom
  select(svg).call(zoom)
}, [])
```

---

## Initial fit

```ts
useEffect(() => {
  const svg = svgRef.current
  if (!svg || !zoomRef.current || tracePoints.length === 0) return
  const { width, height } = svg.getBoundingClientRect()
  const PADDING = 60
  const xs = tracePoints.map(p => p.x)
  const ys = tracePoints.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const dataW = maxX - minX || 1
  const dataH = maxY - minY || 1
  const k = Math.min((width - PADDING * 2) / dataW, (height - PADDING * 2) / dataH)
  const tx = (width - dataW * k) / 2 - minX * k
  const ty = (height - dataH * k) / 2 - minY * k
  select(svg).call(zoomRef.current.transform, zoomIdentity.translate(tx, ty).scale(k))
}, []) // tracePoints are stable (server-rendered)
```

---

## Visual style

- Wrapper: `relative w-full h-screen overflow-hidden`
- SVG: `w-full h-full` (no viewBox — d3-zoom controls the camera)
- Polyline: `stroke="currentColor"`, `strokeWidth={1}`, `opacity={0.6}`, round joins/caps
- Dots: `fill="currentColor"`, 8px radius, 0.5 opacity inactive / 1.0 active, `transition` on r and opacity
- Label: `text-xs text-zinc-500`, no background, `pointerEvents: "none"`

---

## Implementation order

1. Install dependencies
2. `IntersectionDot.tsx` — pure presentational, no state
3. `IntersectionLabel.tsx` — pure presentational, no state
4. `TraceSVG.tsx` — d3-zoom wiring, state, content layer, initial fit, compose dots + label

---

## Files changed

| File | Change |
|---|---|
| `package.json` | Add `d3-zoom`, `d3-selection`, `@types/d3-zoom`, `@types/d3-selection` |
| `app/trace/TraceSVG.tsx` | Full rewrite — orchestrator only |
| `app/trace/IntersectionDot.tsx` | New — SVG dot + hit area |
| `app/trace/IntersectionLabel.tsx` | New — HTML overlay label |

No changes to `app/trace/page.tsx` or any backend files.

---

## Verification

- Open `/trace` — trace fits the viewport on load
- Scroll/pinch to zoom — polyline scales, dots stay 8px
- Drag to pan — feels like a map
- Hover a dot (desktop) — grows to 10px
- Click a dot — label appears anchored to dot, shows dates and text if present
- Zoom/pan while label is open — label tracks the dot
- Click another dot — previous label closes, new one opens
- Click empty space — label dismisses
- `npm test` — no regressions
