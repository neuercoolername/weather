# Wind Trace UI — Specification

## Context

The wind trace is a public page (`/trace`) in a Next.js app. It renders an SVG polyline built from hourly weather observations — each point is displaced from the previous by wind direction and speed. Where the path crosses itself, an intersection dot is shown. Dots are clickable and reveal metadata (dates) and optional user-written text.

The current implementation is a prototype with fundamental architectural problems. This spec defines a rebuild.

---

## Core Problem

The current component uses a single SVG `viewBox` as the camera. Everything — the polyline, dots, text, hit areas — lives in data-coordinate space and scales uniformly. This causes:

- Text becomes unreadable at most zoom levels
- Click targets drift from their visual dots (coordinate mismatch)
- Hit areas scale with zoom, so they're either too small or too large
- No graceful way to add screen-space UI (labels, images) alongside data-space geometry

## Architectural Decision

**Use d3-zoom with a two-layer SVG architecture.**

### Two Layers

1. **Content layer** (`<g>` with zoom transform applied)  
   Contains: the polyline only. Scales and pans with the camera.

2. **UI layer** (`<g>` without zoom transform)  
   Contains: intersection dots, labels, text, and (future) images. Elements are *positioned* in data space (transformed to screen coordinates via the zoom transform) but *sized* in screen pixels. A dot is always ~8px. Text is always ~14px. Hit areas are always comfortable to tap, regardless of zoom level.

### Zoom & Pan

d3-zoom manages the camera. It provides a transform object `{x, y, k}` (translate x/y + scale) derived from user gestures: scroll-wheel zoom, pinch-to-zoom, drag-to-pan.

- Attach d3-zoom to the SVG element via a React ref
- Store the current transform in React state
- Apply the transform as a CSS/SVG `transform` attribute on the content layer `<g>`
- For UI layer elements, compute screen position: `screenX = dataX * k + tx`, `screenY = dataY * k + ty`

This is the standard "semantic zoom" pattern. React owns rendering, d3 owns the gesture/transform math.

---

## Data

The component receives server-side data as props (existing pattern, no change needed):

- **tracePoints**: ordered array of `{ id, x, y, snapshot: { fetchedAt } }`
- **intersections**: array of `{ id, x, y, text, tracePointA: { snapshot: { fetchedAt } }, tracePointB: { snapshot: { fetchedAt } } }`

Coordinate units are km/h (not geographic). Origin is `(0, 0)`.

---

## Interaction Design — User Story

### 1. Landing

User arrives at `/trace`. The full trace path is fitted to the viewport with comfortable padding. They see a thin wandering line with a few small dots scattered along it. Nothing is selected. The page is quiet.

Initial fit: compute the data bounds, then derive a d3-zoom transform that fits those bounds within the viewport with padding. d3-zoom provides utilities for this (`zoomIdentity`, `fitExtent`, or manual calculation from data bounds + viewport size).

### 2. Exploring (zoom & pan)

The user scroll-wheels (desktop) or pinches (mobile) to zoom. The polyline scales — they see more or less detail — but the intersection dots stay the same pixel size. They drag to pan. This should feel like navigating a map.

### 3. Hovering a dot (desktop only)

When the cursor enters a dot's hit area:
- The dot grows subtly (e.g. 8px → 10px radius), with a brief CSS transition
- Cursor becomes `pointer`
- No tooltip, no label — hover is purely a "this is clickable" affordance
- On mobile there is no hover state; the dot is simply tappable

### 4. Clicking a dot

The dot becomes active:
- Dot reaches full opacity
- A **floating label** appears anchored near the dot, offset slightly to the right or above
- The label is an HTML element (CSS-positioned overlay, not SVG `<text>`), so it renders at screen-pixel resolution regardless of zoom level
- Label content:
  - **Date line**: `"Mon DD, YYYY × Mon DD, YYYY"` from the two trace points' `fetchedAt` dates
  - **Text**: the user-written reflection, if present (may be absent)
  - Future: an optional image

The label stays anchored to its dot during zoom/pan — it moves with the camera because its position is recomputed from the dot's data coordinates through the current zoom transform.

### 5. Clicking another dot

The previously active dot deactivates (label disappears, dot returns to default size/opacity). The newly clicked dot activates. **Only one intersection is open at a time.**

### 6. Dismissing

Clicking empty space (anywhere on the SVG that isn't a dot hit area) closes the active intersection. The trace returns to its quiet, unselected state.

### 7. Zooming while a label is open

The label remains anchored to its dot and keeps its screen-pixel size. Both the dot and label move together as the camera changes. This is a natural consequence of the UI-layer architecture — both are positioned via the zoom transform but sized independently of it.

---

### Intersection Dot Sizing

- Visual dot: ~8px radius, fixed in screen space
- Hit area: ~20px radius, fixed in screen space (invisible, overlaid on the visual dot)
- Hover state: ~10px radius (CSS transition)
- Active state: full opacity, label visible

### Label Rendering

The floating label is an **HTML overlay** positioned with CSS `transform` (not an SVG element). This means:
- Text is always crisp and screen-resolution
- Standard CSS typography applies (font, size, color, line-height)
- Future images are trivially added as `<img>` elements inside the overlay
- The overlay `<div>` is absolutely positioned within the SVG's container, coordinates computed from the dot's data position and the current zoom transform

### Backlog (not in scope for this build)

- **Label collision avoidance**: when two dots are close in screen space, their floating labels may overlap. Solving this (e.g. nudging labels apart, or only showing labels above a certain zoom threshold) is deferred.

---

## Visual Style

- Minimal, current aesthetic is good. Thin polyline (~1px at default zoom), muted opacity
- Dots are solid, small, slightly transparent when inactive, fully opaque when active
- The page background is white / near-white
- Text styling: clean sans-serif, muted color, small but readable
- No axes, no grid, no chrome. The trace *is* the page.

---

## Technology

- **d3-zoom** (`d3-zoom` package, ~8kb standalone) — zoom/pan gesture handling and transform math
- **SVG** — rendering (polyline on content layer, dots on UI layer)
- **React** — state management and rendering, existing Next.js integration
- The component is a client component (`"use client"`) within the existing Next.js App Router setup

### Dependencies to Add

- `d3-zoom`
- `d3-selection` (peer dependency of d3-zoom, used for attaching zoom behavior to DOM elements)

Types: `@types/d3-zoom`, `@types/d3-selection`

---

## Future Extensibility (not in scope, but architecture should support)

- **Images per intersection**: added as `<img>` inside the HTML overlay label. No architectural change needed.
- **Label collision avoidance**: nudge overlapping labels apart when dots are close in screen space.
- **Animated zoom-to-dot**: d3-zoom supports smooth transitions between zoom states (click a dot → animate camera to center on it).
- **Mobile gestures**: d3-zoom handles touch events (pinch, drag) natively — no extra work.

---

## File Location

The rebuilt component replaces the existing `app/trace/TraceSVG.tsx`. The server component at `app/trace/page.tsx` should not need changes — it passes the same props.