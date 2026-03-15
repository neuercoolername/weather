# Implementation Plan: Intersection Email Notification

## Overview

Add fire-and-forget email notification via Resend when a wind trace intersection is detected. Email is sent inside the existing hourly weather-fetch cycle, after `detectAndStoreIntersections` persists the crossing to the database.

---

## 1. Install dependency

```
npm install resend
```

---

## 2. New file: `lib/email.ts`

### Exports

**`formatDate(date: Date): string`**
- Formats a UTC Date to "Tuesday 18 Feb 2026, 14:00"
- Uses `Intl.DateTimeFormat` with `en-GB` locale, `Europe/Berlin` timezone, 24h clock
- Exported separately so it can be unit tested

**`sendIntersectionEmail({ id, dateA, dateB })`**
- Lazily initializes a `Resend` client from `process.env.RESEND_API_KEY`
- Builds reply-to address: splits `EMAIL_FROM` on `@`, inserts `+<id>` into local part (e.g. `trace+42@weather.example.com`)
- Calls `resend.emails.send()` with:
  - `from`: `process.env.EMAIL_FROM`
  - `to`: `process.env.NOTIFICATION_EMAIL`
  - `replyTo`: built above
  - `subject`: `Intersection — <dateA> × <dateB>`
  - `text`: plain-text body per spec template

**Email body template:**
```
The wind trace crossed itself.

<dateA> and <dateB> now share a point.

---
Intersection ID: <id>
```

---

## 3. Modify `lib/trace.ts`: `detectAndStoreIntersections`

**Signature change:**
```ts
// Before
async function detectAndStoreIntersections(
  newTracePointId: number,
  prevX: number, prevY: number,
  newX: number, newY: number
): Promise<void>

// After
export async function detectAndStoreIntersections(
  newTracePointId: number,
  newSnapshotId: number,
  prevX: number, prevY: number,
  newX: number, newY: number
): Promise<{ id: number; dateA: Date; dateB: Date }[]>
```

**Implementation changes:**
1. Query `newSnapshot` up front: `prisma.weatherSnapshot.findUniqueOrThrow({ where: { id: newSnapshotId }, select: { fetchedAt: true } })` — gives us `dateB`
2. Augment `allPoints` select: add `snapshotId` and `snapshot: { select: { fetchedAt: true } }`
3. Replace `createMany` with individual `prisma.intersection.create(...)` calls in the loop — so we get each created record's `id` back
4. Collect and return `{ id, dateA: b.snapshot.fetchedAt, dateB: newSnapshot.fetchedAt }` for each intersection found

---

## 4. Modify `lib/weather.ts`: `storeTracePoint`

```ts
async function storeTracePoint(snapshotId: number, windDirection: number, windSpeed: number) {
  const prev = await prisma.tracePoint.findFirst({ orderBy: { createdAt: "desc" } });
  const prevX = prev?.x ?? 0;
  const prevY = prev?.y ?? 0;
  const { x, y } = computeTracePoint(prevX, prevY, windDirection, windSpeed);
  const tracePoint = await prisma.tracePoint.create({ data: { snapshotId, x, y } });
  const intersections = await detectAndStoreIntersections(tracePoint.id, snapshotId, prevX, prevY, x, y);
  for (const ix of intersections) {
    sendIntersectionEmail(ix).catch((err) =>
      console.error(`[Email] Failed to send intersection email for Intersection #${ix.id}:`, err)
    );
  }
}
```

Import `sendIntersectionEmail` from `@/lib/email`.

---

## 5. New file: `lib/email.test.ts`

Tests for `formatDate`:
- Known UTC timestamp (e.g. `2026-02-18T13:00:00.000Z`) → `"Wednesday 18 Feb 2026, 14:00"` (Berlin is UTC+1 in winter)
- A summer timestamp (UTC+2) to verify DST offset
- Verify no "AM"/"PM" in output

---

## 6. Environment variables

Three new variables — all required at runtime, not build time:

| Variable             | Description                                    |
|----------------------|------------------------------------------------|
| `RESEND_API_KEY`     | Resend API key from dashboard                  |
| `NOTIFICATION_EMAIL` | Hardcoded recipient address                    |
| `EMAIL_FROM`         | Verified sender, e.g. `trace@<subdomain>`      |

---

## Integration notes

- Email send is fire-and-forget: a failed send never breaks the weather-fetch cycle
- The intersection is already persisted before the email is attempted
- `storeTracePoint` is itself already called fire-and-forget from `fetchAndStoreWeather`, so no change to the top-level error handling
