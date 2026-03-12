# Wind Trace — Implementation Plan

## Resolved open questions

### Trace point storage
Separate `TracePoint` table with a unique `snapshotId` foreign key — consistent with how `Haiku` is structured. Keeps `WeatherSnapshot` clean and independently usable. 1-to-1 relation, nullable by absence (pre-Feb-17 snapshots simply have no TracePoint row).

### Intersection storage
Single `Intersection` table referencing two `TracePoint` IDs (not snapshot IDs — the intersection is a geometric relationship between two trace points). The `text` field is nullable on the same record.

### Trace display scaling
SVG rendered inside a client component (`<TraceSVG>`). For MVP it renders statically with a computed `viewBox`. The client component boundary is in place so zoom/pan state can be added later (e.g. with `d3-zoom` or pointer event handling) without changing the server data-fetching layer.

### Intersection detection efficiency
O(n) per observation — check the new segment against all previous segments. Fine for years of hourly data (~8,760 points/year). Revisit with spatial indexing if it becomes slow.

---

## Coordinate system

Wind direction (degrees, meteorological: angle FROM which wind blows, clockwise from north) is converted to a displacement:

```
dx =  speed * sin(direction * pi/180)
dy = -speed * cos(direction * pi/180)
```

`dy` is negated so north is up in the SVG (screen Y increases downward). Origin is `(0, 0)`. Units are km/h — abstract, not geographic.

---

## Schema changes

**`prisma/schema.prisma`**

New `TracePoint` model (parallel to `Haiku`):
```prisma
model TracePoint {
  id             Int              @id @default(autoincrement())
  snapshotId     Int              @unique
  snapshot       WeatherSnapshot  @relation(fields: [snapshotId], references: [id])
  x              Float
  y              Float
  createdAt      DateTime         @default(now())
  intersectionsA Intersection[]   @relation("IntersectionA")
  intersectionsB Intersection[]   @relation("IntersectionB")
}
```

New `Intersection` model:
```prisma
model Intersection {
  id            Int        @id @default(autoincrement())
  tracePointIdA Int
  tracePointIdB Int
  tracePointA   TracePoint @relation("IntersectionA", fields: [tracePointIdA], references: [id])
  tracePointB   TracePoint @relation("IntersectionB", fields: [tracePointIdB], references: [id])
  x             Float
  y             Float
  text          String?
  detectedAt    DateTime   @default(now())
}
```

Add back-relation on `WeatherSnapshot`:
```prisma
tracePoint TracePoint?
```

---

## New file: `lib/trace.ts`

All trace geometry lives here.

**`computeTracePoint(prevX, prevY, windDirection, windSpeed)`**
Returns `{ x, y }` for the new point. Pure function, no DB access.

**`segmentsIntersect(p1, p2, p3, p4)`**
Returns `{ x, y } | null`. Standard parametric segment-segment intersection (solve for t, s in (0, 1) exclusive). Returns null if no crossing.

**`detectAndStoreIntersections(newTracePointId, prevX, prevY, newX, newY)`**
- Fetches all TracePoints ordered by `createdAt asc`
- Iterates consecutive pairs to form previous segments
- Skips the immediately adjacent segment (shares an endpoint)
- For each intersection found, writes an `Intersection` record

---

## Changes to `lib/weather.ts`

After `prisma.weatherSnapshot.create(...)`:

1. Read `wind_direction_10m` and `wind_speed_10m` from `current` (already in scope)
2. Fetch the most recent `TracePoint` ordered by `createdAt desc`
3. If none exists, use `(0, 0)` as origin (first trace point)
4. Call `computeTracePoint` to get `{ x, y }`
5. Create TracePoint: `prisma.tracePoint.create({ data: { snapshotId: snapshot.id, x, y } })`
6. Call `detectAndStoreIntersections` — fire-and-forget with `.catch(...)`, same pattern as haiku generation

---

## New file: `app/trace/page.tsx`

Server component, `force-dynamic`.

1. Fetch all TracePoints ordered by `createdAt asc`, select `id, x, y`
2. Fetch all Intersections: `id, x, y, tracePointIdA, tracePointIdB`
3. Pass both to `<TraceSVG>` client component

---

## New file: `app/trace/TraceSVG.tsx`

Client component. Receives trace points and intersections as props.

- Computes `viewBox` from min/max of all points with padding
- Renders `<svg>` with:
  - `<polyline>` for the full trace path
  - `<circle r={4}>` for each intersection dot
- Manages click state: clicking a dot fetches `/api/intersections/[id]` and shows the text in an overlay
- Architecture note: zoom/pan state lives here when added — no server-side changes needed

---

## New file: `app/api/intersections/[id]/route.ts`

**`GET`** — public, returns `{ text: string | null }`.

**`POST`** — authenticated (Bearer `API_KEY`), body `{ text: string }`, updates `Intersection.text`.

---

## New file: `scripts/backfill-trace.ts`

One-time script to compute trace points for all existing snapshots with wind data (post-Feb-17). Run once after migration:

```bash
npx tsx scripts/backfill-trace.ts
```

Logic:
1. Fetch all snapshots with no associated TracePoint, ordered by `fetchedAt asc`
2. For each: extract `wind_direction_10m` and `wind_speed_10m` from `rawJson.current`
3. Skip if either field is missing (pre-Feb-17)
4. Compute trace point from previous stored point, create TracePoint row
5. Run intersection detection for each new segment

---

## Files to create / modify

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `TracePoint` and `Intersection` models; add back-relation to `WeatherSnapshot` |
| `lib/trace.ts` | New — geometry functions |
| `lib/weather.ts` | Wire in trace point creation + intersection detection |
| `app/trace/page.tsx` | New — server component, fetches data |
| `app/trace/TraceSVG.tsx` | New — client component, renders SVG, handles interaction |
| `app/api/intersections/[id]/route.ts` | New — GET (public) + POST (authenticated) |
| `scripts/backfill-trace.ts` | New — one-time backfill |

---

## Implementation order

1. Schema changes + `prisma migrate dev`
2. `lib/trace.ts` — pure geometry, easy to verify in isolation
3. `lib/weather.ts` — wire in trace point creation
4. `scripts/backfill-trace.ts` — run to populate existing data
5. `app/trace/page.tsx` + `TraceSVG.tsx` — display
6. `app/api/intersections/[id]/route.ts` — write interface

---

## Verification

- After migration: confirm TracePoint and Intersection tables exist
- After wiring weather.ts: POST to `/api/location`, confirm a TracePoint row is created for the new snapshot
- After backfill: confirm TracePoint rows exist for post-Feb-17 snapshots, spot-check a few coordinates
- Trace page: open `/trace`, confirm the SVG path renders and intersection dots appear
- Intersection GET: hit `/api/intersections/1`, confirm it returns `{ text: null }`
- Intersection POST: send a Bearer-authed POST with `{ text: "..." }`, reload `/trace`, click the dot to confirm text appears
