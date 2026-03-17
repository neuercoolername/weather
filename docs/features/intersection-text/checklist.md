# Intersection Text Generation — Checklist

## Step 1 — Schema
- [x] Add `IntersectionText` model to `prisma/schema.prisma`
- [x] Add `intersectionText IntersectionText?` relation to `Intersection` model
- [x] Run `npx prisma db push`
- [x] Run `npx prisma generate`

## Step 2 — `lib/intersection-text.ts`
- [x] Implement `formatGapDuration(ms: number): string`
- [x] Implement `buildIntersectionPayload(intersectionId: number)` — fetch relations, compute posture, gap, context window, weatherDescription
- [x] Implement `generateIntersectionText(intersectionId: number)` — build system prompt, call Claude Haiku, store `IntersectionText`, return text
- [x] Run `npm test` — tests passing

## Step 3 — `lib/intersection-text.test.ts`
- [x] Test `formatGapDuration` with edge cases and representative inputs
- [x] Test `buildIntersectionPayload` with mocked prisma (posture, gap duration, context query, locationChanged)
- [x] Test `generateIntersectionText` with mocked prisma + Anthropic SDK
- [x] Run `npm test` — tests passing

## Step 4 — `lib/weather.ts`
- [x] Import `generateIntersectionText` in `lib/weather.ts`
- [x] Modify `notifyIntersections` to await text generation (with try/catch) before emailing
- [x] Pass generated `text` to `sendIntersectionEmail`
- [x] Update `lib/weather.test.ts` to cover `generateIntersectionText` call
- [x] Run `npm test` — tests passing

## Step 5 — `lib/email.ts`
- [x] Add optional `text?: string` to `sendIntersectionEmail` parameter type
- [x] Include text in email body when present
- [x] Update `lib/email.test.ts` to cover optional `text` param
- [x] Run `npm test` — tests passing

## Finishing
- [x] All checklist items complete
- [x] `npm test` — all tests passing (38/38)
- [x] `npm run build` — no errors
- [x] Update `docs/state.md` — add IntersectionText to schema section, note feature complete
- [ ] Update `docs/backlog.md` if applicable
