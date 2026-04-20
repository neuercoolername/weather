# Backlog

## Up next

_(empty)_

## Someday

- [ ] **Reply-to-write** — replying to an intersection notification email writes directly to the intersection's `text` field. Requires: MX records on sending domain pointing to Resend's inbound servers, webhook route `/api/intersections/inbound`, reply-body extraction, webhook auth. See `docs/features/email/email-feature.md` for full design.

*Testing*
- [ ] **Integration tests** — no integration test infrastructure yet. Would catch convention-mismatch bugs (computation vs. rendering) that unit tests miss. Needs a test harness that can assert on rendered output or at minimum on the full computation→DB→query pipeline.
- [ ] **Staging database** — currently only production DB. A staging copy would allow safe backfill dry-runs and destructive testing without risking real data or intersection writing.
- [ ] **Testing stage in pipeline** - add a testing stage in github actions pipeline
- [ ] **E2E tests**