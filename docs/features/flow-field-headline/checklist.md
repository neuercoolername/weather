# Flow-Field Headline — Checklist

- [x] `lib/flow-field.ts` — parameterised engine: `FlowFieldParams` + `DEFAULT_FLOW_FIELD_PARAMS`,
      seeded Perlin + 3-octave fBm, curl noise, Reynolds decomposition, anisotropy, meander, gust
      pulse, length-variance ramp. Pure/numeric.
- [x] `lib/wind-field.ts` — `computeWindField(series)` → `{ dirDeg, meanSpeed, gustFactor, TI,
      meanderDeg }` (mean, gust factor, `TI=(clamp(G,1.1,3)−1)/3`, circular mean + variance).
- [x] `lib/flow-field.test.ts` + `lib/wind-field.test.ts` — unit tests (incl. length ramp; circular
      stats; empty/degenerate inputs). `npm test` green (71 tests).
- [x] `app/trace/FlowFieldHeadline.tsx` — `"use client"` canvas wrapper: mask build (Archivo Black,
      imported in-component), rAF loop w/ `cancelAnimationFrame` cleanup, visibility pause,
      reduced-motion static frame, ink from `--foreground`. (Canvas is text-sized; no ResizeObserver
      needed — width is driven by the measured text.)
- [x] Font: Archivo Black via `next/font/google` imported directly in the component (no `layout.tsx`
      change needed).
- [x] `app/page.tsx` — fetch last 24 snapshots, compute `windField`, pass to `TraceSVG`.
- [x] `app/trace/TraceSVG.tsx` — `latestWind` prop → `windField`, forward to header.
- [x] `app/trace/TraceHeader.tsx` — text = "Trace" | compact dates; render `<FlowFieldHeadline>`;
      add `formatCompactDate`; drop `formatWindLabel`.
- [x] `npm run build` clean.
- [x] Browser MCP verify: animated "Trace" default; compact dates on hover/select; no app console
      errors; legible at size.
- [x] Update `docs/state.md`; mark feature complete.
