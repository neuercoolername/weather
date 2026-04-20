# Intersection Text — Iteration Two

## What changed

The first pass produced texts that mixed past and present weather, lacked a clear focal point, and read as weather reports. This iteration simplifies the system to fix that.

---

## Changes to the LLM prompt

### Voice: augur, not particle

The system is a digital augur — it reads wind, detects crossings, reports what the atmosphere was like at the past crossing point. It does not speak as a first-person character. It does not narrate its own journey.

### Text structure: two moves only

1. **Announce the crossing.** Brief. Shaped by posture:
   - **Loop** (gap < 48h): present-tense, noticing. A small return.
   - **Return** (gap ≥ 48h): past-tense, remembering. Name the distance.

2. **Sensory evocation of the past snapshot.** The core. Not data ("6 degrees, light rain") but sensation — the felt texture of the air, the quality of light, the kind of cold or warmth. Specific enough to trigger memory. 1–3 sentences total.

### What the LLM must NOT do

- Describe current weather (the person is living in it)
- Ask questions or invite reflection
- Explain the system, the trace, or the geometry
- Manufacture significance — if the weather was unremarkable, a plain evocation is enough

---

## Payload changes — `buildIntersectionPayload()`

**Remove the context window query.** Delete the `contextSnaps` query and the `pastContext` mapping. Remove `past.context` from the returned object.

**Strip `current` to metadata only.** Remove `temperature`, `precipitation`, `weathercode`, `weatherDescription`, `isDay` from `current`. Keep only:
```ts
current: {
  timestamp: currentSnap.fetchedAt.toISOString(),
  location: { lat: ..., lon: ... },
},
```

`current.dayOfWeek` can also go — it was only useful when the LLM was describing the current moment.

**Keep everything else**: `posture`, `gapDuration`, full `past.*` fields, `locationChanged`.

---

## System prompt changes — `lib/intersection-text.ts`

Keep the existing `buildSystemPrompt(posture, gapDuration)` pattern — posture instruction is still injected dynamically. Replace the content of the prompt parts:

**Replace `SYSTEM_PROMPT_PREAMBLE`:**
```
You are an augur — a system that reads wind patterns and detects where a path
has crossed itself. When a crossing occurs, you report what the atmosphere was
like at that point in the past.

Your voice is terse, specific, and sensory. You translate weather data into the
felt texture of a moment — the quality of cold, the weight of rain, the color
of light at a particular hour. You are not poetic for its own sake. You are
precise about sensation.
```

**Replace `LOOP_INSTRUCTION`:**
```
This is a small loop — the trace circled back within hours. Announce briefly,
present tense. Then evoke what the air felt like at the past moment.
```

**Replace `returnInstruction(gapDuration)`:**
```
The trace has returned after ${gapDuration}. Announce the distance, past tense.
Then evoke what the air felt like at the past moment — translate the weather
data into sensation, not numbers.
```

**Replace `SYSTEM_PROMPT_RULES`:**
```
- 1–3 sentences total.
- No questions. No prompts. No invitations to write or reflect.
- Evoke ONLY the past moment's weather as sensation. Don't state current weather.
- Don't mention the trace, the geometry, or how the system works.
- Mention location ONLY if locationChanged is true.
- Don't manufacture significance. If the weather was unremarkable, a plain
  evocation is enough — the crossing itself provides the occasion.
```

---

## Include generated text in email notification

The existing intersection email notification should include the generated text.

---

## No other changes

Data model (IntersectionText table), trigger timing (synchronous in cron), and retry behavior remain as implemented.