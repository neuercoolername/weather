# intersectionVisualization — Implementation Plan

## Goal

Replace the single `<polyline>` trace with a weave rendering: at each self-crossing, the chronologically older segment shows a small gap, and the newer segment passes through unbroken.

## Data

`TraceSVG` already receives everything needed:
- `tracePoints[]` — ordered chronologically (oldest first), each with `id`, `x`, `y`
- `intersections[]` — each with `x`, `y`, `tracePointIdA` (end of older segment), `tracePointIdB` (end of newer segment)

No changes to data fetching, DB schema, or `lib/trace.ts`.

## Algorithm (lib/weave.ts)

1. Build `id → index` map over `tracePoints`
2. Segments: segment[i] connects tracePoints[i] → tracePoints[i+1]
3. For each intersection:
   - Older (under) segment = index of tracePointIdA in tracePoints, minus 1
   - Newer (over) segment = index of tracePointIdB in tracePoints, minus 1
4. For each segment, collect all crossings on it, sort by distance from start
5. Split segment into sub-segments at each crossing
6. For under-crossings: shorten adjacent sub-segments by GAP_SIZE/2 each (content-space units)
   - Cap at 25% of adjacent sub-segment length to avoid degenerate stubs
7. Output all sub-segments in chronological order

**Gap constant:** `GAP_SIZE = 2.5` (tune after first render)

## Rendering (TraceSVG.tsx)

Walk sub-segments in order, building SVG path strings. Extend current path when the next sub-segment's start equals the previous end; start a new `M` when there's a gap. Same stroke properties as the current polyline.

## Files

| File | Action |
|---|---|
| `lib/weave.ts` | NEW — pure geometry |
| `lib/weave.test.ts` | NEW — Vitest tests |
| `app/trace/TraceSVG.tsx` | MODIFY — replace `<polyline>` |
