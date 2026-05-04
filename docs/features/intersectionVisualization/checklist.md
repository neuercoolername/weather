# intersectionVisualization — Checklist

- [x] Read docs/state.md
- [x] Read feature spec (intersectionVisualization.md)
- [x] Write implementation-plan.md
- [x] Write this checklist
- [x] Get confirmation before writing code
- [x] Create `lib/weave.ts` with `computeWeaveSegments()`
- [x] Write `lib/weave.test.ts` — no crossings, single crossing, under-at-one/over-at-another, multiple crossings on one segment, gap cap
- [x] `npm test` — all passing (58 tests)
- [x] Update `app/trace/TraceSVG.tsx` — replace `<polyline>` with weave paths
- [ ] Manual visual check at three zoom levels
- [x] `npm run build` — passes
- [x] Update `docs/state.md`
