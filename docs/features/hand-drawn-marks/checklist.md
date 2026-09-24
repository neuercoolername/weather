# Hand-drawn crossing marks — checklist

- [x] `lib/domain/mark-shape.ts` + tests (determinism, bounds, sweep per style, weight picking)
- [x] `TraceMarkParams.ringShape` with prototype defaults
- [x] `app/(trace)/ring-shapes.ts` per-load cache + client-only switch
- [x] `IntersectionDot` draws the path; `TraceDots` passes the key member's shape
- [x] `mark-breathing.ts` scales the path; `TraceSVG` hands over the paths
- [x] `npm test` and `npm run build` green
- [x] Verify in the running app: shapes differ per reload, breathing measured across frames, no hydration warnings
- [x] Update `docs/state.md`
