import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getWeatherDescription } from "@/lib/wmo-codes";

const anthropic = new Anthropic();

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const LOOP_INSTRUCTION =
  `This is a small loop — the trace circled back within hours. Announce briefly, \
present tense. Then evoke what the air felt like at the past moment.`;

const returnInstruction = (gapDuration: string) =>
  `The trace has returned after ${gapDuration}. Announce the distance, past tense. \
Then evoke what the air felt like at the past moment — translate the weather \
data into sensation, not numbers.`;

const SYSTEM_PROMPT_PREAMBLE =
  `You are an augur — a system that reads wind patterns and detects where a path \
has crossed itself. When a crossing occurs, you report what the atmosphere was \
like at that point in the past.

Your voice is terse, specific, and sensory. You translate weather data into the \
felt texture of a moment — the quality of cold, the weight of rain, the color \
of light at a particular hour. You are not poetic for its own sake. You are \
precise about sensation.`;

const SYSTEM_PROMPT_RULES =
  `- 1–3 sentences total.
- No questions. No prompts. No invitations to write or reflect.
- Evoke ONLY the past moment's weather as sensation. Don't state current weather.
- Don't mention the trace, the geometry, or how the system works.
- Mention location ONLY if locationChanged is true.
- Don't manufacture significance. If the weather was unremarkable, a plain \
evocation is enough — the crossing itself provides the occasion.`;

function buildSystemPrompt(posture: "loop" | "return", gapDuration: string): string {
  const postureInstruction =
    posture === "loop" ? LOOP_INSTRUCTION : returnInstruction(gapDuration);

  return `${SYSTEM_PROMPT_PREAMBLE}

${postureInstruction}

Rules:
${SYSTEM_PROMPT_RULES}`;
}

export function formatGapDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const hours = ms / 3_600_000;
  const days = ms / 86_400_000;

  if (hours < 2) return `${minutes} minutes`;
  if (hours < 48) return `${Math.round(hours)} hours`;
  if (days < 14) return `${Math.round(days)} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  const years = days / 365;
  if (years < 1.5) return "almost a year";
  return `about ${Math.round(years)} years`;
}

export async function buildIntersectionPayload(intersectionId: number) {
  const intersection = await prisma.intersection.findUniqueOrThrow({
    where: { id: intersectionId },
    include: {
      tracePointA: {
        include: {
          snapshot: {
            include: { location: true },
          },
        },
      },
      tracePointB: {
        include: {
          snapshot: {
            include: { location: true },
          },
        },
      },
    },
  });

  const pastSnap = intersection.tracePointA.snapshot;
  const currentSnap = intersection.tracePointB.snapshot;

  const gapMs = currentSnap.fetchedAt.getTime() - pastSnap.fetchedAt.getTime();
  const posture: "loop" | "return" = gapMs < 48 * 3_600_000 ? "loop" : "return";

  return {
    posture,
    gapDuration: formatGapDuration(gapMs),
    current: {
      timestamp: currentSnap.fetchedAt.toISOString(),
      location: {
        lat: currentSnap.location.lat,
        lon: currentSnap.location.lon,
      },
    },
    past: {
      timestamp: pastSnap.fetchedAt.toISOString(),
      dayOfWeek: DAYS[pastSnap.fetchedAt.getDay()],
      temperature: pastSnap.temperature,
      precipitation: pastSnap.precipitation,
      weathercode: pastSnap.weathercode,
      weatherDescription: getWeatherDescription(pastSnap.weathercode, pastSnap.isDay),
      isDay: pastSnap.isDay,
      location: {
        lat: pastSnap.location.lat,
        lon: pastSnap.location.lon,
      },
    },
    locationChanged: false,
  };
}

export async function generateIntersectionText(intersectionId: number): Promise<string> {
  const payload = await buildIntersectionPayload(intersectionId);
  const systemPrompt = buildSystemPrompt(payload.posture, payload.gapDuration);

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    system: systemPrompt,
    messages: [{ role: "user", content: JSON.stringify(payload) }],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const text = block.text.trim();

  await prisma.intersectionText.create({
    data: {
      intersectionId,
      text,
      promptPayload: payload,
    },
  });

  return text;
}
