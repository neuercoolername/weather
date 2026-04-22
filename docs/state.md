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
- Relations: `intersectionText` (1-to-1 with `IntersectionText`), `images` (1-to-many with `IntersectionImage`)

### `IntersectionImage`
Image attached to an intersection via the admin CMS.
- Fields: `id` (cuid), `intersectionId` (FK), `storageKey` (path in Supabase Storage bucket `intersection-images`), `caption` (nullable), `createdAt`
- Blobs stored in Supabase Storage (private bucket); access via server-generated signed URLs (1h)

### `IntersectionText`
LLM-generated text per intersection. 1-to-1 with `Intersection`.
- Generated at intersection detection time by Claude Haiku
- Fields: `intersectionId` (FK), `text`, `promptPayload` (full payload sent to LLM), `createdAt`

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

### Intersection text generation ✅
At intersection detection time, Claude Haiku generates a short text spoken in the voice of the trace particle.
Classifies the crossing as "loop" (gap < 48h) or "return" (gap ≥ 48h) and assembles a structured payload (weather conditions, timestamps, ~24h context window around the past point).
Text stored in `IntersectionText` (1-to-1 with `Intersection`). Included in the notification email.
Fire-and-forget — a failed generation never breaks the weather-fetch cycle.
Key files: `lib/intersection-text.ts`

### Intersection email notification ✅
Sends a plain-text email via Resend when a new intersection is detected.
Fire-and-forget — a failed send never breaks the weather-fetch cycle.
Reply-to address is pre-set to `trace+<id>@<domain>` for future inbound handling.
Email includes a direct link to the admin CMS detail page (`BASE_URL/admin/intersections/<id>`).
Requires env vars: `RESEND_API_KEY`, `NOTIFICATION_EMAIL`, `EMAIL_FROM`, `BASE_URL`.

### Admin CMS ✅
Single-password admin interface at `/admin/*` for editing intersection text and managing images.
- Auth: `iron-session` cookie (`ADMIN_PASSWORD`, `SESSION_SECRET`); in-memory brute-force protection (5 attempts/IP/15min)
- Pages: `/admin/login`, `/admin/intersections` (paginated list), `/admin/intersections/[id]` (detail/edit)
- Image storage: Supabase Storage bucket `intersection-images` (private); signed URLs generated server-side
- Requires env vars: `ADMIN_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BASE_URL`
- Key files: `middleware.ts`, `lib/session-config.ts`, `lib/session.ts`, `lib/supabase.ts`, `lib/rate-limit.ts`, `app/admin/`

---

## Key files
- `lib/weather.ts` — fetch, store snapshot, store trace point, fire intersection detection + email notification
- `lib/trace.ts` — pure geometry: `computeTracePoint`, `segmentsIntersect`, `detectAndStoreIntersections`
- `lib/email.ts` — Resend client, `formatDate`, `sendIntersectionEmail`
- `lib/intersection-text.ts` — `formatGapDuration`, `buildIntersectionPayload`, `generateIntersectionText`
- `app/trace/page.tsx` — server component, fetches all trace points + intersections
- `app/trace/TraceSVG.tsx` — client component, d3-zoom orchestrator
- `app/trace/IntersectionDot.tsx` — SVG dot + hit area, fixed screen-pixel size
- `app/trace/IntersectionLabel.tsx` — HTML overlay label, anchored to dot
- `app/api/location/route.ts` — POST endpoint receiving GPS coordinates from iOS app
- `app/api/admin/login/route.ts`, `app/api/admin/logout/route.ts` — admin auth
- `app/api/admin/intersections/[id]/route.ts` — PATCH intersection text
- `app/api/admin/intersections/[id]/images/route.ts` — POST image upload
- `app/api/admin/intersections/[id]/images/[imageId]/route.ts` — PATCH caption, DELETE image
- `scripts/backfill-trace.ts` — one-time backfill for pre-existing snapshots
- `scripts/reset-trace.ts` — deletes all trace points and intersections from DB
- `docs/backlog.md` — project backlog

---

See `docs/backlog.md` for full backlog.