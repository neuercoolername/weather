# Backlog

## Up next

_(empty)_

## Someday

- [ ] **Integration tests** — no integration test infrastructure yet. Would catch convention-mismatch bugs (computation vs. rendering) that unit tests miss. Needs a test harness that can assert on rendered output or at minimum on the full computation→DB→query pipeline.
- [ ] **Staging database** — currently only production DB. A staging copy would allow safe backfill dry-runs and destructive testing without risking real data or intersection writing.