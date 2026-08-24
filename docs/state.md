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
- **Database**: PostgreSQL via Prisma. Production is Supabase; local development runs `postgres:17`
  from `docker-compose.yml` on port 5433, seeded from a nightly backup.
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
  dot on the public trace. That rule is `hasContent` (`lib/domain/intersection-content.ts`); the admin
  "needs content" queue is its inverse, as a Prisma clause in `lib/server/data/admin-intersections.ts`.
- Relations: `images` (1-to-many with `IntersectionImage`)

### `IntersectionImage`
Image attached to an intersection via the admin CMS.
- Fields: `id` (cuid), `intersectionId` (FK), `storageKey` (path in the Supabase Storage bucket named by `SUPABASE_BUCKET`), `createdAt`,
  `width` / `height` / `bytes` (nullable — intrinsic size of the stored image)
- No caption — images stand on their own
- Blobs stored in Supabase Storage (private bucket); access via server-generated signed URLs
  (`SIGNED_URL_EXPIRY = 86400`, i.e. 24h)
- Uploads are normalised on the way in by `lib/server/images.ts`: EXIF-oriented, downscaled to a
  2000px long edge, stripped of metadata and re-encoded as WebP q80. Everything is stored as
  `.webp` regardless of what was uploaded. Knobs live in `IMAGE_CONFIG`.
- iPhone HEIC is decoded by `heic-convert` before sharp sees it — sharp's bundled libvips ships the
  AV1 codec but not libde265, so it can read AVIF and not HEVC-encoded HEIC. It is slow (seconds per
  frame), which is tolerable only because uploads are admin-only.
- `width`/`height` let the client reserve the exact aspect ratio before the bytes arrive, so images
  no longer shift the layout as they load.

---

## Features

### Weather fetching ✅
Hourly cron fetches Open-Meteo data and stores a snapshot (`instrumentation.ts` → `lib/server/cron.ts`).

### Wind trace ✅
Computes and stores trace points on each new snapshot.
Detects intersections after each new segment.
**The trace is the root page** — it lives in the `app/(trace)/` route group: `page.tsx` serves `/`
(parentheses are excluded from the URL) and its components sit beside it.
Renders the full SVG path with interactive intersection marks; only intersections with
something to show get one (`hasContent`: text or at least one image).
Intersection text preserves the newlines it was written with (`whitespace-pre-line` on the
panel's `<p>`); the text stays a flat string, no paragraph parsing.
Writing is edited in the admin CMS — `PATCH /api/admin/intersections/[id]`.

### Wind trace UI rebuild ✅
d3-zoom two-layer SVG: the content layer pans and scales with the camera, the marks layer is
positioned in data space but sized in screen pixels. Selecting a mark pans it to the centre of the
visible (non-panel) area.
Components: `TraceSVG` (orchestrator), `trace-camera` (d3-zoom controller), `TraceDots`,
`IntersectionDot`, `IntersectionPanel` (+ `PanelNav`, `IntersectionImages`, `ImageLightbox`).
On mobile (< 768px) the detail panel is full-screen with bottom nav instead of a side panel.

### Trace marks ✅
Stroke weight and crossing marks are one system, tuned together in a prototype bench and driven by
`TraceMarkParams` (`lib/domain/trace-marks.ts`, defaults = the tuned values, overridable via a
`params` prop on `TraceSVG`). No weight or size literal survives in the render path.

Both widths come off the same curve `base · z^exponent` where `z = k / kFit`, so the mark:trace
stroke ratio is fixed by `markerRatio` at every zoom — previously the trace scaled with the camera
(`strokeWidth={1}` → `1 × k`) while the dots were flat, so the two matched at exactly one scale and
the trace rendered ~0.07px at the fitted view. Everything is relative to `kFit` rather than absolute
`k` because `kFit` shrinks as the trace grows.

Crowded marks collapse into one ring enclosing the group's screen footprint, so ring size means
"how much room this group takes up" — the number of crossings in a group is deliberately not
encoded. Grouping is single-link on distance, never grid-bucketed: a grid's arbitrary cell
boundaries make members flip cells on a hair of zoom and the drawn centroid teleport.

Clicking a group flies to the scale where it *first* comes apart (longest edge of its minimum
spanning tree crossing the link threshold, × `openMargin`), not to its bounding box — fitting the
box overshoots and throws the other members off screen. A group that cannot come apart within the
zoom range opens the first of its members instead; only one place in the trace needs this, where
three crossings sit within 0.02 units of each other and would want `k ≈ 470`.

Marks breathe on the flow-field headline's gust period, with the per-mark phase taken from the
crossing's own `fetchedAt`. The loop is an imperative controller (`mark-breathing.ts`) that writes
`r` directly on the circles, so animation never travels through React state; it pauses on
`visibilitychange` and never starts under `prefers-reduced-motion`, leaving the resting radius.

Two camera bugs fixed alongside: `scaleExtent` had a fixed lower bound (0.1) sitting *above* the
real fit scale, so the first wheel event clamped the zoom up and the whole trace could never be
framed again — the floor now comes from the measured fit. And the fit only ran on data change, so
the trace never re-fitted on window resize; a `ResizeObserver` now handles both the initial fit and
resize, re-fitting only while the viewer has not taken the camera over.

### Intersection weave visualization ⚠️ built, not wired up
The idea: at each self-crossing the chronologically older segment shows a small gap and the newer
segment passes through unbroken. The geometry exists and is fully unit-tested in `lib/domain/trace-weave.ts`
(`computeWeaveSegments`, `buildWeavePaths`) — but **nothing imports it**. `TraceSVG` draws the trace
as one plain `<path>`, so no weave is visible. Either re-wire it or delete the module; the tests pass
either way and won't flag the drift.

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
`BASE_URL` must be an **origin only** — a path on it 404s every emailed admin link.

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
- Key files: `proxy.ts` (Next 16 middleware), `lib/server/auth/redirect.ts`, `lib/server/auth/session-config.ts`, `lib/server/auth/session.ts`, `lib/server/supabase.ts`, `lib/server/auth/rate-limit.ts`, `app/admin/`

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
- Key files: `lib/domain/flow-field.ts`, `lib/domain/wind-field.ts`, `app/(trace)/FlowFieldHeadline.tsx`,
  `app/(trace)/TraceHeader.tsx`, `app/(trace)/flow-field-renderer.ts`, `app/(trace)/page.tsx`.

---

## Library layout

`lib/` has exactly two top-level folders, and the folder name states what the code may touch:

- **`lib/domain/`** — pure. No Prisma, no `fetch`, no `process.env`, no `next/*`. Colocated
  `*.test.ts`. Safe to import from a client component.
- **`lib/server/`** — everything that touches the world. Every file starts with `import "server-only"`,
  so **nothing under `lib/server/` may be imported by a client component except as `import type`.**
  `lib/server/data/` holds the queries that adapt rows into domain types; `lib/server/auth/` the
  session, rate-limit, and redirect glue.

A filename prefix does the grouping a subfolder would (`trace-geometry`, `trace-viewport`,
`trace-weave`), so `lib/domain/` stays flat until a group is large enough to earn a folder. No
`index.ts` barrels anywhere. The convention is written up in the `nextjs-project-structure` skill.

Because `server-only` throws under plain Node resolution, `vitest.config.ts` aliases it to the
package's own `empty.js` — the same module Next resolves it to under the `react-server` condition.

## Key files
- `lib/server/weather-ingest.ts` — fetch, store snapshot, store trace point, fire intersection detection + email notification
- `lib/domain/trace-geometry.ts` — pure geometry: `computeTracePoint`, `segmentsIntersect`
- `lib/server/data/intersection-detection.ts` — `detectAndStoreIntersections` (walks stored points, persists crossings)
- `lib/domain/trace-weave.ts` — `computeWeaveSegments`, `buildWeavePaths` (weave geometry; currently unwired)
- `lib/domain/format-date.ts` — `formatDate`, the one date format shared by emails and admin UI
- `lib/server/email.ts` — Resend client, `sendIntersectionEmail`
- `lib/server/auth/redirect.ts` — `redirectToPath`, `sameOriginUrl`, `safeNextPath` (host-correct auth redirects)
- `lib/domain/trace-viewport.ts` — `computeFitTransform`, `projectToScreen` (pure viewport maths)
- `lib/server/data/trace-points.ts` — `getTracePoints` (ordered points for the public view)
- `lib/server/data/wind.ts` — `getCurrentWindField` (snapshots → `WindField`, keeps rawJson server-side)
- `lib/server/data/intersections.ts` — public/admin intersection queries + signed image URLs; `IntersectionWithImages` type
- `lib/server/images.ts` — upload processing (HEIC decode, orient, downscale, WebP encode); `IMAGE_CONFIG`
- `lib/server/image-urls.ts` — batched + memoised signed URLs; URLs are held for half their validity
  so the query string stays stable across renders and the browser can actually cache the image
- `lib/server/data/admin-intersections.ts` — admin list pagination + `getIntersectionStats`
- `lib/domain/intersection-query.ts` — pure searchParam parsing + `intersectionPageHref` for the admin queue
- `app/(trace)/page.tsx` — server component (the trace page), fetches trace points + intersections + wind field
- `app/(trace)/TraceSVG.tsx` — client component, orchestrator
- `app/(trace)/trace-camera.ts` — d3-zoom controller (`fitScale`, `fit`, `animateTo`, `destroy`)
- `lib/domain/trace-marks.ts` — `TraceMarkParams`, weight curve, grouping, split scale, open action (pure)
- `app/(trace)/mark-breathing.ts` — rAF controller breathing the marks' radii
- `lib/domain/flow-field.ts` — pure parameterised wind flow-field engine (Perlin/fBm, curl, Reynolds decomposition, length ramp)
- `lib/domain/wind-field.ts` — `computeWindField` (mean/gust factor/TI/circular direction stats)
- `app/(trace)/FlowFieldHeadline.tsx` — client canvas rendering the header as an animated quiver
- `app/(trace)/flow-field-renderer.ts` — the canvas draw loop the headline component wraps
- `app/(trace)/TraceHeader.tsx` — chooses header text ("Trace" | compact dates), mounts the flow-field headline
- `app/(trace)/TraceDots.tsx` — the marks layer; one element per group, not per intersection
- `app/(trace)/IntersectionDot.tsx` — SVG ring + hit area, sized in screen pixels
- `app/(trace)/IntersectionPanel.tsx` — detail panel (side on desktop, full-screen on mobile)
- `app/(trace)/PanelNav.tsx`, `app/(trace)/IntersectionImages.tsx`, `app/(trace)/ImageLightbox.tsx` — panel sub-components
- `components/ImageFrame.tsx` — shared image element: reserves the aspect ratio up front and
  cross-fades a hairline frame into the loaded image. The only component outside `app/`, because
  both the trace panel and the admin editor use it.
- `proxy.ts` — Next 16 middleware guarding `/admin/*` and `/api/admin/*`
- `app/api/location/route.ts` — POST endpoint receiving GPS coordinates from iOS app
- `app/api/admin/login/route.ts`, `app/api/admin/logout/route.ts` — admin auth
- `app/api/admin/intersections/[id]/route.ts` — PATCH intersection text
- `app/api/admin/intersections/[id]/images/route.ts` — POST image upload
- `app/api/admin/intersections/[id]/images/[imageId]/route.ts` — DELETE image
- `app/api/admin/location/route.ts` — POST location from the admin web fallback
- `scripts/backfill-trace.ts` — one-time backfill for pre-existing snapshots
- `scripts/backfill-image-variants.ts` — re-processes images stored before the resize pipeline
  (`npm run backfill:images`; dry by default, `--apply` to write)
- `scripts/reset-trace.ts` — deletes all trace points and intersections from DB
- `docs/backlog.md` — project backlog

---

## CI/CD

`.github/workflows/deploy.yml` runs on every push to `main` and on every pull request.

**`verify`** — `npm ci` → `prisma generate` → `npm run typecheck` → `npm run lint` → `npm test`.
Needs no secrets and no services: the whole suite mocks Prisma, `fetch`, and `resend`. The explicit
`prisma generate` is belt-and-braces — `@prisma/client`'s postinstall already generates the client on
`npm ci` — but it keeps the typecheck honest if that postinstall is ever skipped.

`npm run typecheck` is `next typegen && tsc --noEmit`, and the `typegen` half is load-bearing.
`PageProps<'/route'>` is a **global** that Next writes into `.next/types/`, which `tsconfig.json`
includes; a fresh checkout has no `.next` (and no `next-env.d.ts` — it's gitignored), so bare `tsc`
fails with `Cannot find name 'PageProps'`. `next typegen` generates those route types without a full
build, needing no env vars or database. It also keeps local typechecks correct after a route is moved
or deleted, where the stale generated types would otherwise report a route that no longer exists.

**`build-and-deploy`** — gated on `verify` and restricted to pushes to `main`, so a red test, type
error, or lint error stops the pipeline before anything is built or deployed. Builds and pushes the
image to GHCR, runs `prisma migrate deploy`, then pulls and restarts the container over a
cloudflared SSH tunnel.

Limits worth knowing:
- Lint failures gate on **errors only**, though the tree is currently warning-clean, so
  `--max-warnings 0` could now be turned on.
- `verify` does not run `npm run build` — the Docker build does, so a build break still fails the
  pipeline, but only after `verify` passes.
- The image is tagged `:latest` only, so there is no rollback target and the server's `pull` is not
  pinned to the image the run just built.
- Migrations are applied *after* the image is pushed.
- `backup.yml` writes to a GitHub artifact, so the backup lives with the same vendor as the repo
  and covers Postgres only — never the Storage bucket.

Other workflows: `backup.yml` (nightly `pg_dump` to an artifact, 90-day retention),
`baseline.yml` (one-shot `migrate resolve`, manual dispatch), and `run-script.yml`
(manual dispatch, the only sanctioned way to run a script against production).

---

## Environments

`.env` holds local development values; `.env.prod` holds production ones and is never loaded
implicitly. The name is deliberate: Next auto-loads `.env.$(NODE_ENV).local`, so
`.env.production.local` would be read during `npm run build`.

`lib/server/env-guard.ts` is what actually enforces the split, because env-file precedence differs
across Next, the Prisma CLI, and `tsx` — it inspects the *resolved* URLs rather than trusting which
file won. (Empirically: constructing `PrismaClient` is what loads `.env` for scripts.)

- **`assertNotProduction`** — refuses unless the database is local. `ALLOW_PROD=1` unlocks it, and
  `run-script.yml` is the only place that is set. `scripts/reset-trace.ts` passes
  `allowOverride: false`, so nothing unlocks it there.
- **`assertTargetsAgree` / `targetsDisagree`** — refuses writes unless the database and the bucket
  are a matching pair: local database with `intersection-images-dev`, production database with
  `intersection-images`. Both buckets live in the same Supabase project, so the project URL cannot
  tell them apart and the rule keys on `SUPABASE_BUCKET` instead. An unset bucket resolves to the
  production name, which keeps the deployed container working without a new variable. Guards the
  image upload and delete routes and `backfill-image-variants --apply`.

Blobs are remote in development too — only the bucket differs, not the host — so image work needs a
network connection, and `SUPABASE_SERVICE_ROLE_KEY` is the same key for both buckets because they
share a project. The guard constrains what the app does with that key; it does not scope the key
itself. Rows restored from a production dump point at objects in the production bucket and will not
render against the dev bucket; `signedUrlsFor` skips keys it cannot sign, so the page degrades
quietly.

---

See `docs/backlog.md` for full backlog.