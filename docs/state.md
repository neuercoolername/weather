# Project State

> This is the `public` branch — the openly-viewable "haiku" deploy. It diverges from `main`
> (the private, password-gated instance): no viewer gate, no email, no hand-curated text or
> photos, and every self-crossing gets an LLM-generated haiku instead. See
> `docs/public-fork.md` for the full rationale and what differs.

## What this is
A weather art project. A location is set manually via `/admin/location`, and a Next.js server
fetches hourly weather from Open-Meteo for it and stores snapshots in PostgreSQL. The data is
both subject and medium — displayed as a minimal public web page, openly viewable, no login.
The wind trace *is* the public page: `/` renders it, and each self-crossing gets a haiku written
by an LLM from the two crossing weather readings.

---

## Stack
- **Framework**: Next.js (App Router)
- **Database**: PostgreSQL via Prisma. Production is self-hosted on the same Docker network as the
  app (Supabase's free-tier project limit was already hit); local development runs `postgres:17`
  from `docker-compose.yml`'s `db-public` service, port 5434.
- **Weather data**: Open-Meteo API
- **AI**: Anthropic API (`claude-haiku-4-5-20251001`) — writes a haiku per self-crossing intersection
- **Testing**: Vitest (unit only, fully mocked — no DB or network)
- **Typography**: Literata (reading text, the document default) + IBM Plex Mono (technical meta —
  timestamps, ids), both via `next/font/google`; the flow-field header uses Archivo Black as a stencil.
  Wired in `app/layout.tsx` + `app/globals.css` (body font references the next/font `--font-literata`
  var directly — `@theme inline` tokens aren't emitted as `:root` vars).

---

## Schema

### `Location`
GPS coordinate, entered manually via `/admin/location` (`POST /api/admin/location`).
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
- `text` is nullable, and LLM-generated (`lib/server/haiku.ts`) from the two crossing snapshots'
  `rawJson` — not hand-written. An intersection with nothing to show stays part of the line; one
  with text gets a dot on the public trace. That rule is `hasContent`
  (`lib/domain/intersection-content.ts`).
- No image relation on this branch — `IntersectionImage` was removed entirely (photos are
  private-only; see `docs/public-fork.md`).

---

## Features

### Weather fetching ✅
Hourly cron fetches Open-Meteo data and stores a snapshot (`instrumentation.ts` → `lib/server/cron.ts`).
The schedule does not start against a local database — `instrumentation.ts` runs under `next dev`
too, and a dev tick would otherwise write an invented snapshot as if it were real. The check is
`isLocalDatabase`, not `NODE_ENV`, and defaults to *on*: production needs no new variable, since an
unset one there would stop ingest silently. `WEATHER_CRON=1` runs it locally anyway.

### Wind trace ✅
Computes and stores trace points on each new snapshot.
Detects intersections after each new segment.
**The trace is the root page** — it lives in the `app/(trace)/` route group: `page.tsx` serves `/`
(parentheses are excluded from the URL) and its components sit beside it.
Renders the full SVG path with interactive intersection marks; only intersections with
something to show get one (`hasContent`: non-empty text).
Intersection text preserves the newlines it was generated with (`whitespace-pre-line` on the
panel's `<p>`); the text stays a flat string, no paragraph parsing.
Text is written automatically, by `lib/server/haiku.ts`, when the intersection is first detected —
see "Haiku generation" below.

### Wind trace UI rebuild ✅
d3-zoom two-layer SVG: the content layer pans and scales with the camera, the marks layer is
positioned in data space but sized in screen pixels. Selecting a mark pans it to the centre of the
visible (non-panel) area.
Components: `TraceSVG` (orchestrator), `trace-camera` (d3-zoom controller), `TraceDots`,
`IntersectionDot`, `IntersectionPanel` (+ `PanelNav`) — text-only on this branch, no image panel.
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

A hovered or open ring breathes on the flow-field headline's gust period, with the per-mark phase
taken from the crossing's own `fetchedAt`; a resting ring stays static. The loop is an imperative
controller (`mark-breathing.ts`) that writes each ring's scale directly, so animation never
travels through React state — `TraceDots` only lets a hovered/active ring carry the data
attributes the controller looks for, so a resting ring is never in its animated set. It pauses on
`visibilitychange` and never starts under `prefers-reduced-motion`, leaving the resting radius.

Each ring is hand-drawn (`lib/domain/mark-shape.ts`, knobs in `TraceMarkParams.ringShape`): a
unit-radius path scaled to the ring's radius with a non-scaling stroke, so one path serves every
size and breathing only changes the scale. Rings mix four pen styles by weight (overshoot, gap,
closed, multi-pass); open strokes get a lead-in, a flick-off, a slow wander and a sliding centre so
passes are neither parallel nor concentric. Shapes are random per page load, not derived from data,
and cached per crossing id (`ring-shapes.ts`); a group wears its key member's ring, so it keeps its
shape while zooming until that member splits off. The server cannot know the random shapes, so the
first render draws unit circles and the rings switch to their hand-drawn paths after hydration.

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

### Haiku generation ✅
Every newly-detected self-crossing gets a plain 5-7-5 haiku, written by Claude from the two
crossing snapshots' raw Open-Meteo JSON.
- `lib/server/haiku.ts` — `generateHaiku(snapshotA, snapshotB)`, model `claude-haiku-4-5-20251001`,
  system prompt requires a couple of raw field names/values to survive unchanged into the haiku.
- Hook point: `processIntersections()` in `lib/server/weather-ingest.ts`, called right after
  `detectAndStoreIntersections` finds new crossings. Per-intersection try/catch — one bad
  generation never blocks the rest or the ingest cycle.
- Writes straight to `Intersection.text` via `prisma.intersection.update`. No admin override on
  this branch — fully automatic, no per-intersection admin UI at all.
- Requires env var: `ANTHROPIC_API_KEY`.

### Admin CMS ✅
Single-password admin interface, trimmed to just location entry on this branch (no intersection
text/photo editing — that's automatic now, see above).
- Auth: `iron-session` cookie (`ADMIN_PASSWORD`, `SESSION_SECRET`); in-memory brute-force protection (5 attempts/IP/15min)
- Pages: `/admin/login`, `/admin/location` (set the tracked location)
- Requires env vars: `ADMIN_PASSWORD`, `SESSION_SECRET`
- Redirects **never** derive their origin from `req.url`: in a standalone build Next builds that origin
  from the bind address (`0.0.0.0`), not the Host header, which sent login/logout to
  `http://0.0.0.0:3000/admin/...` in production. Route handlers emit a relative `Location`
  (`redirectToPath`); `proxy.ts` needs an absolute URL — Next's middleware pipeline rejects a relative
  one — so it builds one from the forwarded/Host headers (`sameOriginUrl`).
- Key files: `proxy.ts` (Next 16 middleware), `lib/server/auth/redirect.ts`, `lib/server/auth/session-config.ts`, `lib/server/auth/session.ts`, `lib/server/auth/rate-limit.ts`, `app/admin/`

### Public access — no gate ✅
The trace at `/` is openly viewable on this branch — no `VIEWER_PASSWORD`, no login. Only `/admin/*`
stays gated (admin session).

The rules are a pure function, `accessFor` (`lib/domain/access.ts`), returning
`allow | admin-login | unauthorized`; `proxy.ts` is only the shell that unseals the cookie and
turns a verdict into a response.

`/api/location` must never be gated — it accepts a `Bearer` header, not a cookie. It is kept out of
the middleware matcher *and* named in `accessFor`'s always-open set, with a test pinning it. The
matcher lists gated paths explicitly instead of sweeping the site with exclusions, which means a
future gated route must be added there or it ships ungated.

### Time-of-day backdrop ✅
A quiet, alive background for the trace page: eight near-white atmospheric gradients (dawn/morning/
midday/afternoon/evening/dusk/night/late-night), each with its own slow "breathe" pulse, chosen by
the tracked location's real *current* local hour — not the viewer's browser clock. Open-Meteo is
already called with `timezone=auto`, so every snapshot's `rawJson.timezone` is enough to resolve
"now" at the location via `Intl.DateTimeFormat` (same pattern as `format-date.ts`), with no ingest
change needed. Bucket hours and colors are a stylization of that real hour, not a sunrise/sunset
model — the schema has no such field.

The breathe animation (`scale`/`filter: brightness` pulse, 12-22s depending on bucket) runs on its
own fixed, `z-index: -1` layer behind all content, not as a `filter` on a content-bearing element —
a CSS `filter` paints everything inside the element it's on. Rendered from `app/(trace)/page.tsx`
only (both the normal and empty-trace branches); admin is unaffected.
- Key files: `lib/domain/time-of-day.ts` (`resolveTimeOfDay`, `DEFAULT_TIME_OF_DAY_CONFIG`),
  `lib/server/data/time-of-day.ts` (`getCurrentTimeOfDay`), `app/(trace)/TimeOfDayBackdrop.tsx`,
  `app/globals.css` (`.time-of-day-backdrop`, `@keyframes time-of-day-breathe`).

### Search indexing ✅
Blocked two ways, because neither is sufficient alone: `app/robots.ts` disallows all crawlers, which
stops new crawling but also stops a crawler ever *seeing* a `noindex` — so an already-indexed URL
would linger. The `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` header from
`next.config.ts` is the half that de-lists, and applies to every response rather than only HTML.
`app/layout.tsx` carries the metadata equivalent for the page itself.

### Flow-field headline ✅
The `/` header text is rendered as an animated wind **quiver** (short direction strokes, dense inside
the letterforms, faint outside) instead of plain type. The turbulence is a synthetic field whose
statistics match the real wind reading: mean flow from direction + speed, turbulence intensity from the
gust factor (`TI = (G−1)/3`), a slow direction meander from the 24h circular variance, a gust "pulse",
and length variance that ramps with wind speed (stormy feel). The wind reading drives *motion only* —
the text is a phrase from the Beaufort wind scale by default, drawn at random on every page load
(`lib/domain/beaufort.ts`, e.g. "Felt on face"), or the crossing's two dates in compact
`D/M/YY × D/M/YY` form when an intersection is hovered/active.

Every title shares one fixed size (64px, the size "Wind" always had), so the page reads the same
whatever phrase it drew; the text takes its natural width. A phrase wider than the window runs to
the edge and fades out over its last 160px rather than shrinking — shrinking was tried, and below
~40px the quiver's 6px grid cannot draw a letter. At 1440px, 46 of the 49 phrases fit. Phones and
tablets (narrower than 1024px, or no hover) show the word **"Wind"** instead, crossing dates
included. The knobs are `HeadlineLayoutParams` (`lib/domain/headline-layout.ts`), tuned in a bench
that ran the real renderer against every phrase. The renderer sizes itself to its container
(`TraceHeader`, which carries no horizontal padding — the side margin is `gutterPx`) and re-lays
on resize.

The headline is the only preview title the trace has: the marks carry no tooltip. A ring holding
several crossings keeps that same `×` grammar and appends the count of the others —
`18/4/26 × 18/4/26 +1`. A date *span* was rejected: it names an interval nothing happened over, and
reads too easily as the `×` form. The crossing named is `groupKey`'s — the lowest id, which is also
the member `openAction` opens when zoom can never pull the group apart, so in that case the title is
a promise about the click (`trace-marks.test.ts` pins the two together). Merged titles are hover-only,
so they never appear on touch, where a tap zooms the ring apart instead.
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
- `lib/server/weather-ingest.ts` — fetch, store snapshot, store trace point, fire intersection detection + haiku generation
- `lib/server/haiku.ts` — `generateHaiku` (Anthropic call, paired-snapshot haiku prompt)
- `lib/domain/trace-geometry.ts` — pure geometry: `computeTracePoint`, `segmentsIntersect`
- `lib/server/data/intersection-detection.ts` — `detectAndStoreIntersections` (walks stored points, persists crossings)
- `lib/domain/trace-weave.ts` — `computeWeaveSegments`, `buildWeavePaths` (weave geometry; currently unwired)
- `lib/domain/format-date.ts` — `formatDate`, the panel/email date format
- `lib/server/auth/redirect.ts` — `redirectToPath`, `sameOriginUrl`, `safeNextPath` (host-correct auth redirects)
- `lib/domain/trace-viewport.ts` — `computeFitTransform`, `projectToScreen` (pure viewport maths)
- `lib/server/data/trace-points.ts` — `getTracePoints` (ordered points for the public view)
- `lib/server/data/wind.ts` — `getCurrentWindField` (snapshots → `WindField`, keeps rawJson server-side)
- `lib/server/data/intersections.ts` — `getAllIntersections`; `TraceIntersection` type
- `app/(trace)/page.tsx` — server component (the trace page), fetches trace points + intersections + wind field
- `app/(trace)/TraceSVG.tsx` — client component, orchestrator
- `app/(trace)/trace-camera.ts` — d3-zoom controller (`fitScale`, `fit`, `animateTo`, `destroy`)
- `lib/domain/trace-marks.ts` — `TraceMarkParams`, weight curve, grouping, group key, split scale, open action (pure)
- `app/(trace)/mark-breathing.ts` — rAF controller breathing the marks' radii (as a scale)
- `lib/domain/mark-shape.ts` — hand-drawn ring generator: `RingShapeParams`, style weights, unit-radius path (pure)
- `app/(trace)/ring-shapes.ts` — per-page-load ring cache per crossing id, unit circle until hydrated
- `lib/domain/flow-field.ts` — pure parameterised wind flow-field engine (Perlin/fBm, curl, Reynolds decomposition, length ramp)
- `lib/domain/wind-field.ts` — `computeWindField` (mean/gust factor/TI/circular direction stats)
- `app/(trace)/FlowFieldHeadline.tsx` — client canvas rendering the header as an animated quiver
- `app/(trace)/flow-field-renderer.ts` — the canvas draw loop the headline component wraps
- `lib/domain/trace-headline.ts` — the header text (the phrase | `D/M/YY × D/M/YY` | + ` +n`) (pure)
- `lib/domain/beaufort.ts` — the Beaufort phrase list and `randomPhrase` (pure)
- `lib/domain/headline-layout.ts` — `HeadlineLayoutParams` (fixed size, fade, compact threshold) (pure)
- `app/(trace)/TraceHeader.tsx` — positions the flow-field headline; takes its text as a prop
- `app/(trace)/TraceDots.tsx` — the marks layer; one element per group, not per intersection
- `app/(trace)/IntersectionDot.tsx` — SVG ring + hit area, sized in screen pixels
- `app/(trace)/IntersectionPanel.tsx` — detail panel (side on desktop, full-screen on mobile), text-only
- `app/(trace)/PanelNav.tsx` — panel prev/next/close controls
- `lib/domain/time-of-day.ts` — `resolveTimeOfDay`, `DEFAULT_TIME_OF_DAY_CONFIG` (pure)
- `lib/server/data/time-of-day.ts` — `getCurrentTimeOfDay` (latest snapshot's timezone → current
  local hour → bucket)
- `app/(trace)/TimeOfDayBackdrop.tsx` — the fixed, non-interactive breathing backdrop layer
- `lib/domain/access.ts` — `accessFor`, the pure access rules for every gated path (admin-only on this branch)
- `proxy.ts` — Next 16 middleware guarding `/admin/*`; the shell around `accessFor`
- `app/robots.ts` — disallow-all, paired with the `X-Robots-Tag` header in `next.config.ts`
- `app/api/location/route.ts` — POST endpoint for GPS coordinates (kept ungated; unused by the manual-entry flow but not removed)
- `app/api/admin/login/route.ts`, `app/api/admin/logout/route.ts` — admin auth
- `app/api/admin/location/route.ts` — POST location from the admin web form
- `scripts/backfill-trace.ts` — one-time backfill for pre-existing snapshots
- `scripts/reset-trace.ts` — deletes all trace points and intersections from DB
- `docs/backlog.md` — project backlog
- `docs/public-fork.md` — why this branch exists and what differs from `main`

---

## CI/CD

`.github/workflows/deploy.yml` is a tracked file like any other, so this branch simply carries
its own independent copy — edited only here, triggers only on `public`. `main`'s copy of the
same filename is untouched and keeps deploying `main` exactly as before. No branch conditionals,
no second filename.

**`verify`** — `npm ci` → `prisma generate` → `npm run typecheck` → `npm run lint` → `npm test`.
Needs no secrets and no services: the whole suite mocks Prisma and `fetch`. The explicit
`prisma generate` is belt-and-braces — `@prisma/client`'s postinstall already generates the client on
`npm ci` — but it keeps the typecheck honest if that postinstall is ever skipped.

**`build-and-deploy`** mirrors `main`'s job but pushes `ghcr.io/neuercoolername/weather:public`
instead of `:latest`, and deploys the `weather-public` compose service at `wind.davidamberg.work`.
Its database is `weather-public-db`, a self-hosted Postgres container on the same Docker network
(Supabase's free-tier project limit was hit) — never exposed to the internet, so unlike `main`,
migrations don't run from the GitHub Actions runner. Instead the SSH deploy step runs
`docker compose run --rm --no-deps --user root weather-public sh -c "npm install -g prisma@<ver>
&& npx prisma migrate deploy"` on the server itself, which resolves `DATABASE_URL`/`DIRECT_URL`
from `infra-repo`'s `.env` the same way `up` does — no GitHub secret holds a database credential
for this branch at all. By decision, `ANTHROPIC_API_KEY`/`ADMIN_PASSWORD`/`SESSION_SECRET` are
reused from `main`'s values rather than made distinct; only the database is new. See
`docs/public-fork.md` for the full env/infra split and why (Cloudflare Access TCP tunneling was
the alternative, rejected for adding a reachable-from-outside path to a database that otherwise
never needs one).

`npm run typecheck` is `next typegen && tsc --noEmit`, and the `typegen` half is load-bearing.
`PageProps<'/route'>` is a **global** that Next writes into `.next/types/`, which `tsconfig.json`
includes; a fresh checkout has no `.next` (and no `next-env.d.ts` — it's gitignored), so bare `tsc`
fails with `Cannot find name 'PageProps'`. `next typegen` generates those route types without a full
build, needing no env vars or database. It also keeps local typechecks correct after a route is moved
or deleted, where the stale generated types would otherwise report a route that no longer exists.

`build-and-deploy` is gated on `verify` and restricted to pushes to `public`, so a red test, type
error, or lint error stops the pipeline before anything is built or deployed. Builds and pushes the
image to GHCR, runs `prisma migrate deploy`, then pulls and restarts the container over a
cloudflared SSH tunnel.

Limits worth knowing:
- Lint failures gate on **errors only**, though the tree is currently warning-clean, so
  `--max-warnings 0` could now be turned on.
- `verify` does not run `npm run build` — the Docker build does, so a build break still fails the
  pipeline, but only after `verify` passes.
- The image is tagged `:public` only, so there is no rollback target and the server's `pull` is not
  pinned to the image the run just built. Re-tagging also orphans the previous image on every
  deploy, so the deploy ends with `docker image prune -f` — without it the server's disk fills and
  the next pull fails part-way through extracting a layer.
- Migrations are applied *after* the image is pushed.
- `backup.yml` writes to a GitHub artifact, so the backup lives with the same vendor as the repo.
  On this branch its content (generated haikus) isn't sensitive the way `main`'s hand-written text
  was, but it still targets `main`'s DB only today — it does not yet cover the `public` DB (see
  `docs/public-fork.md`'s open question on this).

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
- **`isLocalDatabase`** — the underlying test, also read directly by `cron.ts` to decide whether
  this process may reach the outside world at all (see Weather fetching).

No storage bucket exists on this branch, so there's no bucket-pairing guard to maintain — that
concern (and `lib/server/supabase.ts`/`images.ts`) was removed along with `IntersectionImage`.

---

See `docs/backlog.md` for full backlog.