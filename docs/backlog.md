# Backlog

## Up next

- [ ] **Nav icons** — the panel's `←` `→` `✕` are bare Unicode glyphs set in the serif body face
  (`PanelNav.tsx`), so they sit at inconsistent optical weights (`✕` is noticeably heavier than the
  arrows) and read in the wrong voice for a control. Three directions were prototyped in the trace
  marks bench and none chosen: hairline SVG drawn at the trace's own stroke weight; the same glyphs
  reset in IBM Plex Mono; or a set built from the trace's own vocabulary (a crossing at a real angle
  for close, one thread deflected by another for the arrows).

- [ ] **Panel nav within an opened group** — a mark can now stand for several crossings, but the
  panel's prev/next still walks the global list (`getNeighbourIds`). When a group is opened by
  falling back to its first member — the case where zoom can never separate it — the other members
  are only reachable by stepping through everything else. Walking within the group first, then out
  to the global list, would make that fallback feel deliberate rather than lossy.

## Someday

- [ ] **Weave gap — continuous rendering** — the current weave logic (`lib/domain/trace-weave.ts`) applies gaps to the chronologically older segment at each self-crossing. Because the gap must stay within the bounds of a discrete backend segment, there is a hard constraint triangle: a gap cannot simultaneously be (1) large/visible, (2) symmetric (centered on the crossing), and (3) bounded by the segment endpoints. The current formula sacrifices (2) — it uses an asymmetric per-side cap (`gBefore = min(gapHalf, distBefore)`, `gAfter = min(gapHalf, distAfter)`), so gaps near a segment endpoint skew visually toward one side. The root cause is that the presentation layer is aware of backend segment boundaries. The clean fix is a continuous rendering model: treat the trace as a single parametric polyline, represent intersections as crossing parameters along that polyline (not as segment endpoint IDs), and apply fixed-size gaps centered on those parameters — entirely independent of where segment boundaries happen to fall.

- [ ] **Reply-to-write** — replying to an intersection notification email writes directly to the intersection's `text` field. Requires: MX records on sending domain pointing to Resend's inbound servers, webhook route `/api/intersections/inbound`, reply-body extraction, webhook auth. See `docs/features/email/email-feature.md` for full design.

*Testing*
- [ ] **Integration tests** — no integration test infrastructure yet. Would catch convention-mismatch bugs (computation vs. rendering) that unit tests miss. Needs a test harness that can assert on rendered output or at minimum on the full computation→DB→query pipeline.
- [ ] **Off-site backups** — `backup.yml` writes to a GitHub artifact, so the only copy of the data lives with the same vendor as the repo and expires after 90 days. Storage blobs are not backed up at all.
- [ ] **E2E tests**