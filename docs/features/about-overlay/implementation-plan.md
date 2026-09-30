# About overlay — implementation plan

## Domain (pure, tested)
`lib/domain/about.ts`
- `AboutParams` + `DEFAULT_ABOUT_PARAMS`: the tuned values from `description.md`, one config object
  so they stay adjustable in one place.
- `aboutMeta(first: Date, hours: number, crossings: number): string` builds the meta line,
  e.g. `17 Feb 2026 – now · 4,558 hours · 140 crossings`.

`lib/domain/mark-shape.ts`
- Export `seededRandom(seed)` (mulberry32), moved from `mark-shape.test.ts`. The button's ring
  uses a fixed seed, so its shape is the one chosen in the prototype and is the same on server and
  client, with no post-hydration swap like the crossing rings need.

## Data
`app/(trace)/page.tsx` computes the meta line on the server and passes it down as a string:
`tracePoints[0].snapshot.fetchedAt`, `tracePoints.length`, and the count of intersections with
`hasContent`. Formatting on the server avoids a hydration mismatch when server and viewer time
zones put the first date on different days.

## Components (`app/(trace)/`)
- `AboutButton.tsx`: 48px hit area, positioned `absolute` bottom-left. Draws the ring
  (`handDrawnRingPath(seededRandom(seed), ringShape)`, non-scaling stroke) and the *i*.
  `aria-expanded`, `aria-label="About this page"`. Breathing is a CSS keyframe animation that runs
  only on `:hover` or `[aria-expanded="true"]`; values come in as CSS custom properties from
  the params, and it is off under `prefers-reduced-motion`.
- `AboutPanel.tsx`: the sheet. Left side, `max(360px, 33%)` wide, `border-r zinc-200`,
  `role="dialog"`. It slides on a transform, so it stays mounted and can animate both ways.
  It has the meta line, the `✕` (reusing `PanelNav`'s button styling) and the two paragraphs.
  Full-screen below `md`, where the button hides while it is open and `✕` closes it.
  Esc closes it. Focus moves to `✕` on open and back to the button on close.

## Wiring (`TraceSVG.tsx`)
- `aboutOpen` state next to `activeId`. The two panels exclude each other: opening About clears
  `activeId`, activating a crossing closes About, and a click on the empty trace closes both
  (the existing `handleClose`).
- `IntersectionPanel`'s Esc handler only exists while it is mounted, so the two never fight.

## Dev indicator
The Next dev indicator sits in the same corner. Set `devIndicators: { position: "bottom-right" }`
in `next.config.ts`. This is dev-only and does not affect production.

## Tests
- `about.test.ts`: `aboutMeta` formatting (thousands separator, date format, singular/plural not
  needed at these counts, but zero crossings is covered).
- `mark-shape.test.ts`: imports `seededRandom` instead of its local copy; a determinism test for
  it (same seed, same path).
- Components are not unit-tested (the suite is pure/mocked only). Verified in the running app.
