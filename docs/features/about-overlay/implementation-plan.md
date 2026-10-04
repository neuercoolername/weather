# About overlay — implementation plan

## Domain (pure, tested)
`lib/domain/about.ts`
- `AboutParams` + `DEFAULT_ABOUT_PARAMS`: the tuned values from `description.md`, one config object
  so they stay adjustable in one place.

`lib/domain/mark-shape.ts`
- Export `seededRandom(seed)` (mulberry32), moved from `mark-shape.test.ts`. The button's ring
  uses a fixed seed, so its shape is the one chosen in the prototype and is the same on server and
  client, with no post-hydration swap like the crossing rings need.

## Components (`app/(trace)/`)
- `AboutButton.tsx`: 48px hit area, positioned `absolute` bottom-left. Draws the ring
  (`handDrawnRingPath(seededRandom(seed), ringShape)`, non-scaling stroke) and the *i*.
  `aria-expanded`, `aria-label="About this page"`. Breathing is a CSS keyframe animation that runs
  only on `:hover` or `[aria-expanded="true"]`; values come in as CSS custom properties from
  the params, and it is off under `prefers-reduced-motion`.
- `AboutPanel.tsx`: the sheet. Left side, a two-column grid (text column at `measureCh`, `closeGapPx`, then the ✕) whose
  width is the panel's width, `border-r zinc-200`,
  `role="dialog"`. It slides on a transform, so it stays mounted and can animate both ways.
  It has the paragraphs and the `✕`. The `✕`'s layout box is just the glyph, one line of copy
  tall so it centres on the text's first line; its tap target is a `::before`.
  Full-screen below `md`. The button hides while the panel is open, at every width; `✕`, Esc or
  a click on the trace closes it.
  Esc closes it. Focus moves to the panel on open (no ring on a mouse open; Tab reaches `✕`)
  and back to the button on close.

## Wiring (`TraceSVG.tsx`)
- `aboutOpen` state next to `activeId`. The two panels exclude each other: opening About clears
  `activeId`, activating a crossing closes About, and a click on the empty trace closes both
  (the existing `handleClose`).
- `IntersectionPanel`'s Esc handler only exists while it is mounted, so the two never fight.

## Dev indicator
The Next dev indicator sits in the same corner. Set `devIndicators: { position: "bottom-right" }`
in `next.config.ts`. This is dev-only and does not affect production.

## Tests
- `mark-shape.test.ts`: imports `seededRandom` instead of its local copy; a determinism test for
  it (same seed, same path).
- Components are not unit-tested (the suite is pure/mocked only). Verified in the running app.
