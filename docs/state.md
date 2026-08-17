# Project State

## What this is
A weather art project. An iOS app posts GPS coordinates to a Next.js server,
which fetches hourly weather from Open-Meteo and stores snapshots in PostgreSQL.
The data is both subject and medium — displayed as a minimal public web page.
The wind trace *is* the public page: `/` renders it, and writing about its
self-crossings is added by hand through the admin CMS.

---

## Stack
- **Framework**: Next.js (App Router)
- **Database**: PostgreSQL via Prisma
- **Weather data**: Open-Meteo API
- **Testing**: Vitest (unit only, fully mocked — no DB or network)
- **iOS**: Expo Go (GPS tracking only)
- **Typography**: Literata (reading text, the document default) + IBM Plex Mono (technical meta —
  timestamps, ids), both via `next/font/google`; the flow-field header uses Archivo Black as a stencil.
  Wired in `app/layout.tsx` + `app/globals.css` (body font references the next/font `--font-literata`
  var directly — `@theme inline` tokens aren't emitted as `:root` vars).

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
- Relations: `tracePoint`

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
- `text` is nullable, and hand-written in the admin CMS — not generated. An intersection
  with nothing to show stays part of the line; one with text **or** at least one image gets a
  dot on the public trace. That rule is `hasContent` (`lib/intersection-content.ts`); the admin
  "needs content" queue is its inverse, as a Prisma clause in `lib/admin/intersections.ts`.
- Relations: `images` (1-to-many with `IntersectionImage`)

### `IntersectionImage`
Image attached to an intersection via the admin CMS.
- Fields: `id` (cuid), `intersectionId` (FK), `storageKey` (path in Supabase Storage bucket `intersection-images`), `createdAt`
- No caption — images stand on their own (the field was dropped in `20260816104623_drop_image_caption`, unused)
- Blobs stored in Supabase Storage (private bucket); access via server-generated signed URLs
  (`SIGNED_URL_EXPIRY = 86400`, i.e. 24h)

---

## Features

### Weather fetching ✅
Hourly cron fetches Open-Meteo data and stores a snapshot (`instrumentation.ts` → `lib/cron.ts`).

### Wind trace ✅
Computes and stores trace points on each new snapshot.
Detects intersections after each new segment.
**The trace is the root page** — `app/page.tsx` renders it; `/trace` is a `redirect("/")` kept
so old links resolve. The `app/trace/` directory still holds all the trace components.
Renders the full SVG path with interactive intersection dots; only intersections with
non-empty `text` get a dot.
Intersection text preserves the newlines it was written with (`whitespace-pre-line` on the
panel's `<p>`); the text stays a flat string, no paragraph parsing.
Writing is edited in the admin CMS — `PATCH /api/admin/intersections/[id]`.

### Wind trace UI rebuild ✅
d3-zoom two-layer SVG: trace scales with camera, dots stay fixed pixel size.
Selecting a dot pans it to the centre of the visible (non-panel) area.
Components: `TraceSVG` (orchestrator), `traceCamera` (d3-zoom controller), `TraceDots`,
`IntersectionDot`, `IntersectionPanel` (+ `PanelNav`, `IntersectionImages`, `ImageLightbox`).
On mobile (< 768px) the detail panel is full-screen with bottom nav instead of a side panel.

### Intersection weave visualization ⚠️ built, not wired up
The idea: at each self-crossing the chronologically older segment shows a small gap and the newer
segment passes through unbroken. The geometry exists and is fully unit-tested in `lib/weave.ts`
(`computeWeaveSegments`, `buildWeavePaths`) — but **nothing imports it any more**. `TraceSVG`
currently draws the trace as one plain `<path>`, so no weave is visible. Either re-wire it or
delete the module; the tests pass either way and won't flag the drift.

The notes below still describe the geometry as written (backlog references them).
Gap size is `GAP_SIZE = 10` content-space units (zoom-invariant). The gap formula is asymmetric:
each side is capped independently to the available space — `gBefore = min(gapHalf, distBefore)`,
`gAfter = min(gapHalf, distAfter)`. This ensures every crossing is always visible, at the cost of
visual skew when a crossing is near a segment endpoint (see backlog for the constraint triangle and
future direction).

### Intersection email notification ✅
Sends a plain-text email via Resend when a new intersection is detected.
Fire-and-forget — a failed send never breaks the weather-fetch cycle.
Reply-to address is pre-set to `trace+<id>@<domain>` for future inbound handling.
Email includes a direct link to the admin CMS detail page (`BASE_URL/admin/intersections/<id>`).
Requires env vars: `RESEND_API_KEY`, `NOTIFICATION_EMAIL`, `EMAIL_FROM`, `BASE_URL`.
`BASE_URL` must be an **origin only** — no path (a stray `/trace` made every emailed admin link a 404).

### Admin CMS ✅
Single-password admin interface at `/admin/*` for editing intersection text and managing images.
- Auth: `iron-session` cookie (`ADMIN_PASSWORD`, `SESSION_SECRET`); in-memory brute-force protection (5 attempts/IP/15min)
- Pages: `/admin/login`, `/admin/intersections` (paginated list, `?filter=needs-content` — no text *and*
  no images — preserved across pages), `/admin/intersections/[id]` (detail/edit, prev/next),
  `/admin/location` (web fallback for setting the current location without the iOS app)
- List-page URL state follows the Next.js `searchParams` convention: read via `toSearchParams`
  (collapses repeated params, drops empties) and written via `intersectionPageHref`, which seeds
  from the current query so any param added later survives pagination
- Image storage: Supabase Storage bucket `intersection-images` (private); signed URLs generated server-side
- Requires env vars: `ADMIN_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BASE_URL`
- Redirects **never** derive their origin from `req.url`: in a standalone build Next builds that origin
  from the bind address (`0.0.0.0`), not the Host header, which sent login/logout to
  `http://0.0.0.0:3000/admin/...` in production. Route handlers emit a relative `Location`
  (`redirectToPath`); `proxy.ts` needs an absolute URL — Next's middleware pipeline rejects a relative
  one — so it builds one from the forwarded/Host headers (`sameOriginUrl`).
- Key files: `proxy.ts` (Next 16 middleware), `lib/redirect.ts`, `lib/session-config.ts`, `lib/session.ts`, `lib/supabase.ts`, `lib/rate-limit.ts`, `app/admin/`

### Flow-field headline ✅
The `/` header text is rendered as an animated wind **quiver** (short direction strokes, dense inside
the letterforms, faint outside) instead of plain type. The turbulence is a synthetic field whose
statistics match the real wind reading: mean flow from direction + speed, turbulence intensity from the
gust factor (`TI = (G−1)/3`), a slow direction meander from the 24h circular variance, a gust "pulse",
and length variance that ramps with wind speed (stormy feel). The wind reading drives *motion only* —
the text is the word **"Trace"** by default, or the crossing's two dates in compact `D/M/YY × D/M/YY`
form when an intersection is hovered/active.
- Always animating; pauses when the tab is hidden; single static frame under `prefers-reduced-motion`.
- Engine is pure + parameterised (`FlowFieldParams`, defaults = the tuned values) so the "feel" stays
  tunable; the canvas component is a thin wrapper. Stencil mask uses Archivo Black (`next/font`).
- Server computes a compact `windField = { dirDeg, meanSpeed, gustFactor, TI, meanderDeg }` from the
  last 24 hourly snapshots (`wind_gusts_10m` + `wind_direction_10m` from `rawJson.current`) — no
  rawJson crosses to the client.
- Key files: `lib/flow-field.ts`, `lib/wind-field.ts`, `app/trace/FlowFieldHeadline.tsx`,
  `app/trace/TraceHeader.tsx`, `app/trace/flowFieldRenderer.ts`, `app/page.tsx`.
  (`lib/compass.ts` is now unused in full — only its own test imports it.)

### Removed: AI generation pipeline ❌
Dropped in `4ac55a9` ("move trace to root, remove AI generation pipeline"), together with the
`Haiku` and `IntersectionText` models. There is no Anthropic call anywhere in the codebase now,
and no per-snapshot haiku. Intersection text is written by hand in the admin CMS.
Leftovers not yet cleaned up: `@anthropic-ai/sdk` is still a dependency with no importer,
`ANTHROPIC_API_KEY` is still in `.env.example`, and `package.json` has `backfill:texts`,
`backfill:texts:email`, and `reset:texts` scripts pointing at files that no longer exist.

---

## Key files
- `lib/weather.ts` — fetch, store snapshot, store trace point, fire intersection detection + email notification
- `lib/trace.ts` — pure geometry: `computeTracePoint`, `segmentsIntersect`, `detectAndStoreIntersections`
- `lib/weave.ts` — `computeWeaveSegments`, `buildWeavePaths` (weave geometry; currently unwired)
- `lib/email.ts` — Resend client, `formatDate`, `sendIntersectionEmail`
- `lib/redirect.ts` — `redirectToPath`, `sameOriginUrl`, `safeNextPath` (host-correct auth redirects)
- `lib/camera.ts` — `computeFitTransform`, `projectToScreen` (pure camera maths)
- `lib/data/trace-points.ts` — `getTracePoints` (ordered points for the public view)
- `lib/data/wind.ts` — `getCurrentWindField` (snapshots → `WindField`, keeps rawJson server-side)
- `lib/intersections.ts` — public/admin intersection queries + signed image URLs; `IntersectionWithImages` type
- `lib/admin/intersections.ts` — admin list pagination, filter hrefs, `getIntersectionStats`
- `app/page.tsx` — server component (the trace page), fetches trace points + intersections + wind field
- `app/trace/page.tsx` — `redirect("/")` only
- `app/trace/TraceSVG.tsx` — client component, orchestrator
- `app/trace/traceCamera.ts` — d3-zoom controller (`fit`, `animateTo`, `destroy`)
- `lib/flow-field.ts` — pure parameterised wind flow-field engine (Perlin/fBm, curl, Reynolds decomposition, length ramp)
- `lib/wind-field.ts` — `computeWindField` (mean/gust factor/TI/circular direction stats)
- `app/trace/FlowFieldHeadline.tsx` — client canvas rendering the header as an animated quiver
- `app/trace/flowFieldRenderer.ts` — the canvas draw loop the headline component wraps
- `app/trace/TraceHeader.tsx` — chooses header text ("Trace" | compact dates), mounts the flow-field headline
- `app/trace/TraceDots.tsx` — the fixed-pixel dots layer
- `app/trace/IntersectionDot.tsx` — SVG dot + hit area, fixed screen-pixel size
- `app/trace/IntersectionPanel.tsx` — detail panel (side on desktop, full-screen on mobile)
- `app/trace/PanelNav.tsx`, `app/trace/IntersectionImages.tsx`, `app/trace/ImageLightbox.tsx` — panel sub-components
- `proxy.ts` — Next 16 middleware guarding `/admin/*` and `/api/admin/*`
- `app/api/location/route.ts` — POST endpoint receiving GPS coordinates from iOS app
- `app/api/admin/login/route.ts`, `app/api/admin/logout/route.ts` — admin auth
- `app/api/admin/intersections/[id]/route.ts` — PATCH intersection text
- `app/api/admin/intersections/[id]/images/route.ts` — POST image upload
- `app/api/admin/intersections/[id]/images/[imageId]/route.ts` — DELETE image
- `app/api/admin/location/route.ts` — POST location from the admin web fallback
- `scripts/backfill-trace.ts` — one-time backfill for pre-existing snapshots
- `scripts/reset-trace.ts` — deletes all trace points and intersections from DB
- `docs/backlog.md` — project backlog

---

## CI/CD

`.github/workflows/deploy.yml` runs on every push to `main` and on every pull request.

**`verify`** — `npm ci` → `prisma generate` → `npm run typecheck` → `npm run lint` → `npm test`.
Needs no secrets and no services: the whole suite mocks Prisma, `fetch`, and `resend`. The explicit
`prisma generate` is belt-and-braces — `@prisma/client`'s postinstall already generates the client on
`npm ci` — but it keeps the typecheck honest if that postinstall is ever skipped.

**`build-and-deploy`** — gated on `verify` and restricted to pushes to `main`, so a red test, type
error, or lint error stops the pipeline before anything is built or deployed. Builds and pushes the
image to GHCR, runs `prisma migrate deploy`, then pulls and restarts the container over a
cloudflared SSH tunnel.

Limits worth knowing:
- Lint failures gate on **errors only**. Three `@next/next/no-img-element` warnings are outstanding
  (`app/trace/ImageLightbox.tsx`, `app/trace/IntersectionImages.tsx`,
  `app/admin/intersections/[id]/ImageItem.tsx`); `--max-warnings 0` is off until those are converted.
- `verify` does not run `npm run build` — the Docker build does, so a build break still fails the
  pipeline, but only after `verify` passes.
- The image is tagged `:latest` only, so there is no rollback target and the server's `pull` is not
  pinned to the image the run just built.
- Migrations are applied *after* the image is pushed, and never against a non-prod database.

Other workflows: `backup.yml` (nightly `pg_dump` to an artifact, 90-day retention),
`baseline.yml` (one-shot `migrate resolve`, manual dispatch).

---

See `docs/backlog.md` for full backlog.