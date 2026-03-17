# Intersection Text Generation — Feature Spec

**Status**: Draft
**Date**: March 2026

---

## What this is

When the wind trace crosses itself, the system generates a short text spoken in the voice of the trace particle. The text is the artifact — a moment where the atmosphere recognizes its own past. The accumulated intersection texts, alongside the visual trace, form the artwork.

---

## Architecture

The system has two layers:

### 1. Algorithmic layer (runs at intersection detection time)

Classifies the intersection and assembles a structured data payload for the LLM.

**Posture classification**
Two postures, determined by the time gap between the two crossing snapshots:

- **Loop** (gap < 48 hours): The particle is circling, stuttering, noticing. Present-tense energy. Not about memory — about attention to now.
- **Return** (gap ≥ 48 hours): The particle has been away and come back. Past-tense energy. Recognition, not observation.

The 48-hour threshold is a starting value. Tune after living with it.

**Payload assembly**

For each intersection, assemble:

| Field | Source | Notes |
|---|---|---|
| `posture` | Computed | `"loop"` or `"return"` |
| `gapDuration` | Computed | Human-readable string: "6 hours," "3 weeks," "almost a year" |
| `current.timestamp` | Current snapshot | ISO datetime |
| `current.dayOfWeek` | Computed | "Saturday," "Wednesday," etc. |
| `current.temperature` | Current snapshot | °C |
| `current.precipitation` | Current snapshot | mm |
| `current.weathercode` | Current snapshot | WMO code, resolved to description |
| `current.isDay` | Current snapshot | boolean |
| `current.location` | Current snapshot's Location | lat/lon + reverse-geocoded city name (TBD) |
| `past.timestamp` | Past snapshot | ISO datetime |
| `past.dayOfWeek` | Computed | |
| `past.temperature` | Past snapshot | °C |
| `past.precipitation` | Past snapshot | mm |
| `past.weathercode` | Past snapshot | WMO code, resolved to description |
| `past.isDay` | Past snapshot | boolean |
| `past.location` | Past snapshot's Location | |
| `past.context` | ~24h of snapshots around the past point | Array of {timestamp, temperature, precipitation, weathercode, isDay} |
| `locationChanged` | Computed | boolean — true if current and past locations differ meaningfully |

**Explicitly excluded from payload**: wind direction and speed. The particle doesn't know *why* it arrived — the wind is consumed in the motion. The trace is what remains.

### 2. LLM layer

Receives the payload and generates the intersection text.

**System prompt** (to be refined — this is the conceptual shape):

```
You are the trace — a particle moved by the wind across a city. You don't choose
where you go. Sometimes your path crosses itself, and in that moment you recognize
a place you've been before.

You speak at these crossings. You are terse. You state what you notice — atmospheric
conditions, time, season, the feel of the air. You don't ask questions. You don't
direct the reader. You speak and then you're silent.

Rules:
- Speak in first person.
- {posture_instruction} [injected based on loop/return classification]
- Find what is notable in the weather data. A storm matters more than a mild afternoon.
  Contrast between the two moments matters. A sudden change in the hours around the
  past crossing matters. But if nothing is remarkable, say so plainly — don't
  manufacture significance.
- Mention location ONLY if locationChanged is true. When it appears, it should
  feel significant — the particle traveled.
- Never explain the system, the geometry, or how intersections work.
- No questions. No prompts. No invitations to reflect.
- 1–3 sentences. Rarely more.
```

**Posture instructions** (injected into system prompt):

- **Loop**: "This is a small loop — you were just here, hours ago. You are noticing, not remembering. Present tense. Brief."
- **Return**: "You have been away a long time. You are returning. You recognize this place from {gapDuration} ago. Past tense for the memory, present tense for the arrival."

**User message**: the assembled payload as structured JSON.

---

## Data model

### New table: `IntersectionText`

1-to-1 with `Intersection`. Separate table for easy reset/regeneration, same pattern as `Haiku` and `TracePoint`.

| Field | Type | Notes |
|---|---|---|
| `id` | `Int` | Primary key |
| `intersectionId` | `Int` | FK to `Intersection`, unique |
| `text` | `String` | The generated text |
| `promptPayload` | `Json?` | Full payload sent to the LLM (for debugging/iteration) |
| `createdAt` | `DateTime` | When generated |

**TBD**: Whether the existing nullable `text` field on `Intersection` (for user-written responses) remains part of the feature. The generated text is the primary artifact. Whether the system also invites a human response is an open question.

---

## Trigger and timing

Text generation fires synchronously at intersection detection time, during the hourly cron job. If generation fails (API timeout, etc.), store the intersection without text and retry on the next cycle.

---

## Context window for past snapshot

The `past.context` field contains **~24 hours of snapshots** surrounding the past crossing point (12 hours before, 12 hours after, or whatever is available). This gives the LLM enough to identify:

- Weather transitions (rain starting/stopping, temperature drops)
- Time-of-day context (a snapshot at 3am during a stretch of warm nights)
- Intensity patterns (was this the peak of a storm or the tail end?)

**Not MVP**: larger lookback windows for season-scale patterns ("the first snow," "a week-long heat streak"). These require scanning weeks/months of data and are a future enhancement. The 24h window is the pragmatic starting point.

---

## Location handling

**MVP**: Single location (Berlin). Location is included in the payload for atmospheric context (the LLM knows what Berlin weather feels like) but never surfaced in the text since `locationChanged` is always false.

**Future**: When the app travels with the user, reverse-geocode snapshot locations to city-level names. The `locationChanged` flag triggers when the two crossing points are in different cities. The particle then names the place — and naming it is the signal that geography, not just time, was crossed.

---

## Open questions

1. **User response field**: Does the system invite human writing alongside the generated text, or is the generated text the complete artifact? TBD — live with the generated texts first, then decide.

2. **LLM model**: Which model to use for generation. The texts are short and the voice is constrained — a smaller model may be sufficient and keeps cost/latency low. Test with claude-haiku first.

3. **Voice refinement**: The system prompt above is a starting point. The particle voice will need tuning after seeing real outputs against real intersection data. Plan for iteration.

4. **Lookback expansion**: When/whether to expand the past context window beyond 24h for season-scale pattern recognition.

5. **Notification**: Email notification already exists for intersections. The generated text should be included in the notification email.