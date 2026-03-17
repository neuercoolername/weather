# Intersection Text Generation — Implementation Plan

## Overview

When the wind trace crosses itself, an LLM generates a short text spoken in the voice of the trace particle. Text fires at intersection detection time during the hourly cron. If generation fails, the intersection is stored without text and retried next cycle. The generated text is included in the notification email.

---

## Step 1 — Prisma schema: add `IntersectionText`

Add to `prisma/schema.prisma`:

```prisma
model IntersectionText {
  id             Int          @id @default(autoincrement())
  intersectionId Int          @unique
  intersection   Intersection @relation(fields: [intersectionId], references: [id])
  text           String
  promptPayload  Json?
  createdAt      DateTime     @default(now())
}
```

Also add `intersectionText IntersectionText?` to the `Intersection` model.

Apply with: `npx prisma db push`

---

## Step 2 — New file: `lib/intersection-text.ts`

### Exports

**`formatGapDuration(ms: number): string`**

Converts a millisecond gap to a human-readable string:
- < 2h → "X minutes"
- < 48h → "X hours"
- < 14 days → "X days"
- < 60 days → "X weeks"
- < 365 days → "X months"
- ≥ 365 days → "almost a year" / "about X years"

---

**`buildIntersectionPayload(intersectionId: number): Promise<IntersectionPayload>`**

Fetches the intersection with full relations and assembles the structured payload:

1. Fetch `Intersection` with:
   - `tracePointA → snapshot → location`
   - `tracePointB → snapshot → location`
   - (`tracePointA` = past crossing point; `tracePointB` = current)
2. Compute gap in ms between the two `fetchedAt` timestamps
3. Classify posture: gap < 48h → `"loop"`, else `"return"`
4. Fetch `past.context`: WeatherSnapshots with `fetchedAt` within 12h before/after the past snapshot's time, ordered by `fetchedAt`
5. Resolve weathercode descriptions using `getWeatherDescription(code, isDay)` from `lib/wmo-codes.ts`
6. MVP: `locationChanged = false` always; include `lat`/`lon` from location records

Payload shape:
```typescript
{
  posture: "loop" | "return",
  gapDuration: string,
  current: {
    timestamp: string,       // ISO
    dayOfWeek: string,       // "Monday", etc.
    temperature: number,
    precipitation: number,
    weathercode: number,
    weatherDescription: string,
    isDay: boolean,
    location: { lat: number, lon: number }
  },
  past: {
    timestamp: string,
    dayOfWeek: string,
    temperature: number,
    precipitation: number,
    weathercode: number,
    weatherDescription: string,
    isDay: boolean,
    location: { lat: number, lon: number },
    context: Array<{ timestamp: string, temperature: number, precipitation: number, weathercode: number, weatherDescription: string, isDay: boolean }>
  },
  locationChanged: boolean
}
```

---

**`generateIntersectionText(intersectionId: number): Promise<string>`**

1. Call `buildIntersectionPayload(intersectionId)`
2. Build system prompt (from spec), injecting posture instruction
3. Call Claude Haiku (`claude-haiku-4-5-20251001`, max_tokens: 150) with payload as JSON user message
4. Store result in `IntersectionText` with `promptPayload` = the assembled payload
5. Return the generated text string

---

## Step 3 — Modify `lib/weather.ts`

In `notifyIntersections`, before emailing each intersection, attempt text generation:

```typescript
async function notifyIntersections(
  intersections: { id: number; dateA: Date; dateB: Date }[]
): Promise<void> {
  for (const ix of intersections) {
    let text: string | undefined;
    try {
      text = await generateIntersectionText(ix.id);
    } catch (err) {
      console.error(`[IntersectionText] Failed for Intersection #${ix.id}:`, err);
    }
    sendIntersectionEmail({ ...ix, text }).catch((err) =>
      console.error(`[Email] Failed for Intersection #${ix.id}:`, err)
    );
  }
}
```

Add import: `import { generateIntersectionText } from "@/lib/intersection-text";`

---

## Step 4 — Modify `lib/email.ts`

- Add optional `text?: string` to the `sendIntersectionEmail` parameter type
- If `text` is present, include it in the email body after "The wind trace crossed itself."

---

## Step 5 — Tests

**New file: `lib/intersection-text.test.ts`**
- `formatGapDuration`: representative inputs (30min, 6h, 2 days, 10 days, 6 weeks, 400 days)
- `buildIntersectionPayload`: mocked prisma — verify posture classification, gap duration string, context window query range, `locationChanged = false`
- `generateIntersectionText`: mocked prisma + Anthropic SDK — verify text stored, text returned

**Updates:**
- `lib/weather.test.ts` — cover new `generateIntersectionText` call in `notifyIntersections`
- `lib/email.test.ts` — cover optional `text` parameter

---

## Files modified

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `IntersectionText` model + relation on `Intersection` |
| `lib/intersection-text.ts` | New file |
| `lib/intersection-text.test.ts` | New file |
| `lib/weather.ts` | Wire in text generation in `notifyIntersections` |
| `lib/email.ts` | Accept optional `text` param, include in email body |
| `lib/weather.test.ts` | Update for new `generateIntersectionText` call |
| `lib/email.test.ts` | Update for optional `text` param |
