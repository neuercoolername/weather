# Project State

## What this is
A weather art project. An iOS app posts GPS coordinates to a Next.js server,
which fetches hourly weather from Open-Meteo and stores snapshots in PostgreSQL.
The data is both subject and medium — displayed as a minimal public web page.

---

## Stack
- **Framework**: Next.js (App Router)
- **Database**: PostgreSQL via Prisma
- **Weather data**: Open-Meteo API
- **Testing**: Vitest
- **iOS**: Expo Go (GPS tracking only)

---

## Schema

### `Location`
GPS coordinate posted by the iOS app.
- Fields: `lat`, `lon`, `createdAt`
- Relations: `snapshots` (1-to-many with `WeatherSnapshot`)

### `WeatherSnapshot`
Hourly weather observation. Core table.
- Stores raw Open-Meteo response as `rawJson`
- Key fields: `locationId` (FK to Location), `temperature`, `precipitation`, `windspeed`, `weathercode`, `isDay`, `rawJson`, `fetchedAt`
- Extended fields (wind direction etc.) added Feb 17 — earlier rows are missing wind data in rawJson
- Relations: `haiku`, `tracePoint`

### `Haiku`
LLM-generated haiku per snapshot. 1-to-1 with `WeatherSnapshot`.

### `TracePoint`
Precomputed (x, y) position for each observation. 1-to-1 with `WeatherSnapshot`.
- Wind direction + speed → displacement from previous point
- Origin is `(0, 0)`. Units are km/h, not geographic.
- **Convention** Cartesian — +y = north, +x = east. SVG renderer flips y at render boundary.
- Only exists for snapshots from Feb 17 onward (first with wind data)

### `Intersection`
Records when the wind trace crosses itself.
- References two `TracePoint` IDs (not snapshot IDs)
- Stores crossing coordinates `(x, y)`
- `text` is nullable — user writes a short reflection per intersection, but doesn't have to

---

## Features

### Weather fetching ✅
Hourly cron fetches Open-Meteo data, stores snapshot, generates haiku.

### Wind trace ✅
Computes and stores trace points on each new snapshot.
Detects intersections after each new segment.
Public page at `/trace` renders full SVG path with interactive intersection dots.
Authenticated POST to `/api/intersections/[id]` to add writing.

### Wind trace UI rebuild ✅
d3-zoom two-layer SVG: polyline scales with camera, dots stay fixed pixel size.
HTML overlay label anchored to active dot; tracks during zoom/pan.
Components: `TraceSVG` (orchestrator), `IntersectionDot`, `IntersectionLabel`.

---

## Key files
- `lib/weather.ts` — fetch, store snapshot, store trace point, fire intersection detection
- `lib/trace.ts` — pure geometry: `computeTracePoint`, `segmentsIntersect`, `detectAndStoreIntersections`
- `app/trace/page.tsx` — server component, fetches all trace points + intersections
- `app/trace/TraceSVG.tsx` — client component, d3-zoom orchestrator
- `app/trace/IntersectionDot.tsx` — SVG dot + hit area, fixed screen-pixel size
- `app/trace/IntersectionLabel.tsx` — HTML overlay label, anchored to dot
- `app/api/location/route.ts` — POST endpoint receiving GPS coordinates from iOS app
- `app/api/intersections/[id]/route.ts` — GET removed, POST authenticated
- `scripts/backfill-trace.ts` — one-time backfill for pre-existing snapshots
- `scripts/reset-trace.ts` — deletes all trace points and intersections from DB
- `docs/backlog.md` — project backlog

---

See `docs/backlog.md` for full backlog.