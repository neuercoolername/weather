# Backlog

## Up next

_(empty)_

## Someday

- [ ] **Weave gap — continuous rendering** — the current weave logic (`lib/weave.ts`) applies gaps to the chronologically older segment at each self-crossing. Because the gap must stay within the bounds of a discrete backend segment, there is a hard constraint triangle: a gap cannot simultaneously be (1) large/visible, (2) symmetric (centered on the crossing), and (3) bounded by the segment endpoints. The current formula sacrifices (2) — it uses an asymmetric per-side cap (`gBefore = min(gapHalf, distBefore)`, `gAfter = min(gapHalf, distAfter)`), so gaps near a segment endpoint skew visually toward one side. The root cause is that the presentation layer is aware of backend segment boundaries. The clean fix is a continuous rendering model: treat the trace as a single parametric polyline, represent intersections as crossing parameters along that polyline (not as segment endpoint IDs), and apply fixed-size gaps centered on those parameters — entirely independent of where segment boundaries happen to fall.

- [ ] **Reply-to-write** — replying to an intersection notification email writes directly to the intersection's `text` field. Requires: MX records on sending domain pointing to Resend's inbound servers, webhook route `/api/intersections/inbound`, reply-body extraction, webhook auth. See `docs/features/email/email-feature.md` for full design.

*Testing*
- [ ] **Integration tests** — no integration test infrastructure yet. Would catch convention-mismatch bugs (computation vs. rendering) that unit tests miss. Needs a test harness that can assert on rendered output or at minimum on the full computation→DB→query pipeline.
- [ ] **Staging database** — currently only production DB. A staging copy would allow safe backfill dry-runs and destructive testing without risking real data or intersection writing.
- [ ] **Testing stage in pipeline** - add a testing stage in github actions pipeline
- [ ] **E2E tests**