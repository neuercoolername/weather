# Checklist: Intersection Email Notification

## Steps

- [x] Install `resend` npm package
- [x] Create `lib/email.ts` with `formatDate` and `sendIntersectionEmail`
- [x] Create `lib/email.test.ts` with `formatDate` unit tests
- [x] Run `npm test` — all tests pass
- [x] Modify `detectAndStoreIntersections` in `lib/trace.ts` to accept `newSnapshotId` and return intersection date data
- [x] Run `npm test` — all tests pass
- [x] Update `storeTracePoint` in `lib/weather.ts` to pass `snapshotId` and fire emails
- [x] Run `npm test` — all tests pass
- [x] Run `npm run build` — clean build
- [X] Add `RESEND_API_KEY`, `NOTIFICATION_EMAIL`, `EMAIL_FROM` to `.env` ← you
- [x] Update `docs/state.md` to reflect new feature
- [x] Update `docs/backlog.md` to add reply-to-write backlog item
