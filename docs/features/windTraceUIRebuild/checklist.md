# Wind Trace UI Rebuild — Checklist

## 1. Dependencies ✅
- [x] `npm install d3-zoom d3-selection`
- [x] `npm install -D @types/d3-zoom @types/d3-selection`

## 2. `IntersectionDot.tsx` (new) ✅
- [x] Props: `sx`, `sy`, `isActive`, `isHovered`, `onClick`, `onMouseEnter`, `onMouseLeave`
- [x] Transparent hit circle `r={20}`
- [x] Visual circle `r={isHovered ? 10 : 8}`, CSS transition, opacity from `isActive`

## 3. `IntersectionLabel.tsx` (new) ✅
- [x] Props: `sx`, `sy`, intersection with `tracePointA`, `tracePointB`, `text`
- [x] Absolutely-positioned `<div>` offset from dot
- [x] Date line: Euro-style `"DD Mon YYYY × DD Mon YYYY"` from `fetchedAt`
- [x] Conditional text block if `intersection.text` is present

## 4. `TraceSVG.tsx` — rewrite ✅
- [x] State: `transform`, `activeId`, `hoveredId`; refs: `svgRef`, `zoomRef`
- [x] d3-zoom wiring (`useEffect` on mount, `scaleExtent([0.1, 20])`, updates `transform`)
- [x] Content layer `<g>` with `transform` applied — polyline only
- [x] UI layer `<g>` — render `IntersectionDot` for each intersection at screen coords
- [x] Initial fit (`useEffect` on mount, compute scale + translate from data bounds + viewport size)
- [x] Render `IntersectionLabel` when `activeId !== null`
- [x] Dismiss on SVG background click; dot clicks `stopPropagation`
- [x] `npm test` — no regressions
