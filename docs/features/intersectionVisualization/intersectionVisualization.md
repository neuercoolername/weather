# Intersection weave — iteration 1

## Goal

At each crossing in the wind trace, the line visibly passes over itself: one thread continues unbroken, the other has a small gap where the first crosses. The weave emerges from the trace itself — no overlays, no redrawn segments.

No hover behavior in this iteration. No labels. Just the resting weave.

## The approach

Render the trace as a sequence of sub-segments, drawn in chronological order (oldest first, newest last). Split every segment at any crossing point it passes through. Each sub-segment inherits the timestamp of its parent segment.

At each crossing, the two segments involved each get split in two at the crossing point. The newer segment is drawn last, so it naturally appears on top — but that alone gives overlap, not a visible weave. To make the weave visible, the under-segment (the older one) has its two halves shortened slightly so they don't meet at the crossing point. A small gap remains, through which the over-segment passes uninterrupted.

The result: the over-thread is the actual trace, continuous through the crossing. The under-thread is the actual trace, minus a small gap at the crossing. Nothing is redrawn. Nothing is overlaid.

## Resting state behavior

- At each crossing, the older segment has a visible gap where the newer segment crosses
- The newer segment passes through the crossing unbroken
- Which is older vs newer is determined by the timestamp of the underlying trace points
- A segment that is "under" at one crossing may be "over" at another — each crossing is independent
- Segments not involved in any crossing are drawn as-is

## Gap sizing

- Gap is measured in content-space units (same coordinate system as the trace points), so it scales with zoom naturally
- Starting value: ~2–3× the trace's stroke width
- If a segment is very short relative to the gap, cap the gap at some fraction of the segment's length (e.g. 25%) to avoid degenerate cases
- Exact value to be tuned by eye after first render

## Multiple crossings on one segment

Rare but possible: a single trace segment may be part of multiple crossings (crossing two older segments on its way to the next trace point). Handling:

- Collect all crossing points that fall on the segment
- Sort them along the segment (by distance from segment start)
- Split the segment into N+1 sub-segments
- Each split inherits the segment's timestamp
- Gaps are applied per crossing to whichever sub-segments are "under" there

## Rendering

- Sub-segments can be grouped into continuous runs between crossings and rendered as single paths, rather than one path per sub-segment, to keep SVG element count manageable
- Draw order must be chronological — earlier runs drawn first, later runs drawn on top
- All sub-segments render with the same stroke width, color, opacity, and line cap as the current base trace. No visual distinction between "over" and "under" sub-segments beyond the gap itself.

## What stays

- `Intersection` records in the DB (crossing coordinates + two trace point ids)
- `TracePoint` records and the existing hourly pipeline
- Hit areas on crossings (invisible, for click handling)
- Click behavior opening the existing detail view
- Everything about `detectAndStoreIntersections` in `lib/trace.ts` — only how the trace is rendered changes

## Verification

The iteration is complete when:

- Every crossing in the trace shows a visible over/under weave: one thread continuous, the other broken
- The weave is chronologically correct: older segment is the one with the gap, newer segment passes over
- No dark patches, floating stubs, reinforced bits, or visual seams anywhere on the trace
- Non-crossing portions of the trace look identical to before this change
- At the three zoom levels in the current app (full overview, mid, close), the weave reads clearly at mid and close zoom; at very low zoom the gap may become too small to see, which is acceptable
- Dense crossing clusters (several crossings near each other) render without producing floating line fragments; if this edge case is tricky, flag it rather than shipping a broken result

## Out of scope

- Hover behavior (fixed label, thickening, gap-widen) — separate iteration
- On-load pulse — separate iteration
- Click/modal — unchanged
- Mobile-specific interactions — separate concern
- Performance optimization beyond grouping sub-segments into continuous runs — defer until measured

## Update when done

- `docs/state.md` — update the Wind trace UI section to describe the new rendering approach
- Note in whatever feature doc lives alongside this iteration