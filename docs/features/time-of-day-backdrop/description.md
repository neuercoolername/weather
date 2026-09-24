# Time-of-Day Backdrop — Feature Spec

**Status**: Complete
**Type**: Public UI (app code)

---

## What this is

A quiet, alive background for the trace page: eight near-white atmospheric gradients (dawn, morning,
midday, afternoon, evening, dusk, night, late-night), each with its own slow "breathe" pulse, chosen
by the real current local time at the tracked location — not the viewer's browser clock. The trace
itself stays the one bold element; the backdrop is a barely-there mood shift behind it, alive rather
than static.

Ported from a dumped `useBackground.ts` + `globals.css` pair found in another project. The mechanism
changed (no Redux, no `document.body` class toggling — this app has neither); the actual look is a
near value-for-value port of the reference `globals.css`'s eight gradients and per-bucket breathe
timings.

## Decisions

- **Data source**: the latest `WeatherSnapshot`'s `rawJson.timezone` (Open-Meteo is called with
  `timezone=auto`, so this is already stored on every snapshot), resolved to the location's *current*
  local hour via `Intl.DateTimeFormat` — the same pattern `lib/domain/format-date.ts` already uses.
  Not `fetchedAt` (server/UTC clock) and not the viewer's clock.
- **Buckets**: eight named periods, hour ranges matching the original hook (dawn 5-7, morning 7-11,
  midday 11-15, afternoon 15-17, evening 17-19, dusk 19-21, night 21-2, late-night 2-5). These are a
  stylization of a real hour, not a claim about this location's actual sunrise/sunset minute — the
  schema has no such field.
- **Palette**: near-white 5-stop gradients per bucket, close to the reference's exact hex values.
  Deliberately not saturated/colorful (an earlier, more vivid direction was explicitly rejected) and
  never black/white.
- **Motion**: a continuous `@keyframes` breathe (subtle `scale`/`filter: brightness` pulse), 12-22s
  depending on bucket, slower at night — matching the reference. Runs on its own layer behind all
  content, not as a `filter` on a content-bearing element (a CSS `filter` paints everything inside
  the element it's on, so applying it to `body` itself would have pulsed the trace and headline's
  brightness too). Respects `prefers-reduced-motion`.
- **Placement**: a fixed, `z-index: -1` layer rendered from `app/(trace)/page.tsx` (both the normal
  and empty-trace branches), not `app/layout.tsx`/`body` — admin and viewer-login are tools, not part
  of the art object, and stay unaffected.
- **Staleness**: the page is `force-dynamic` with no live polling anywhere in the app; a tab left open
  across an actual bucket change won't update until reload, consistent with the rest of the site.
  Since the hour is resolved fresh on every server render, each reload shows the true current bucket.

## Data

Latest snapshot only — `prisma.weatherSnapshot.findFirst({ orderBy: { fetchedAt: "desc" }, select: { rawJson: true } })`,
extracting `rawJson.timezone` and resolving "now" in that zone. `lib/server/data/time-of-day.ts`.

## Out of scope

- A sunrise/sunset-based continuous gradient — would need a real ingest change (Open-Meteo's `daily`
  block isn't currently fetched).
- Bucket boundaries presented as astronomically precise — they're a stylization, not a solar model.
- Any `body`/layout-level application.
- Viewer-clock-driven timing of any kind.

## Key files

- `lib/domain/time-of-day.ts` — pure: `resolveTimeOfDay(hour)` → bucket name, gradient, breathe
  duration; `DEFAULT_TIME_OF_DAY_CONFIG` holds the eight buckets' hours/colors/timings
- `lib/domain/time-of-day.test.ts` — bucket boundaries, wraparound, fractional hours, custom config
- `lib/server/data/time-of-day.ts` — `getCurrentTimeOfDay()`: latest snapshot's timezone → current
  local hour → `resolveTimeOfDay`
- `app/(trace)/TimeOfDayBackdrop.tsx` — the fixed backdrop layer (no client JS; pure CSS animation)
- `app/globals.css` — `.time-of-day-backdrop`, `@keyframes time-of-day-breathe`,
  `prefers-reduced-motion` guard
- `app/(trace)/page.tsx` — fetches and wires in `getCurrentTimeOfDay()`
