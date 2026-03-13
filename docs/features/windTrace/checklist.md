# Wind Trace — Implementation Checklist

## 1. Schema ✅
- [x] Add `TracePoint` model to `prisma/schema.prisma`
- [x] Add `Intersection` model to `prisma/schema.prisma`
- [x] Add `tracePoint TracePoint?` back-relation to `WeatherSnapshot`
- [x] Run `prisma db push`

## 2. Test setup ✅
- [x] Vitest installed, `test` / `test:watch` scripts in `package.json`

## 3. Geometry (`lib/trace.ts`) ✅
- [x] `computeTracePoint(prevX, prevY, windDirection, windSpeed)`
- [x] `segmentsIntersect(p1, p2, p3, p4)`
- [x] `detectAndStoreIntersections(newTracePointId, prevX, prevY, newX, newY)`

### Tests (`lib/trace.test.ts`) ✅
- [x] `computeTracePoint` — cardinal directions, zero speed, non-origin start (12 tests, all passing)
- [x] `segmentsIntersect` — crossing, parallel, collinear, T-junction, out-of-bounds, shared endpoint

## 4. Wire into weather pipeline (`lib/weather.ts`) ✅
- [x] Refactored into `fetchWeather`, `storeSnapshot`, `storeHaiku`, `storeTracePoint`
- [x] Compute and store `TracePoint` after each snapshot
- [x] Fire-and-forget intersection detection

### Tests (`lib/weather.test.ts`) ✅
- [x] Throws on non-OK Open-Meteo response
- [x] Uses (0, 0) as origin for the first trace point
- [x] Continues from previous trace point coordinates

## 5. Backfill (`scripts/backfill-trace.ts`)
- [x] Write script (`npm run backfill`)
- [X] Run script against production DB

## 6. Display (`app/trace/`) ✅
- [x] `page.tsx` — server component, fetch trace points + intersections (including `text`)
- [x] `TraceSVG.tsx` — client component, SVG render + click to reveal note (no client-side fetch)

## 7. Admin write interface (`app/api/intersections/[id]/route.ts`) ✅
- [x] `POST` — update text (authenticated); GET removed, text is fetched server-side
