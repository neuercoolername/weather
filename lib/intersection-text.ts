import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getWeatherDescription } from "@/lib/wmo-codes";

const anthropic = new Anthropic();

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const LOOP_INSTRUCTION =
  "This is a small loop — you were just here, hours ago. You are noticing, not remembering. Present tense. Brief.";

const returnInstruction = (gapDuration: string) =>
  `You have been away a long time. You are returning. You recognize this place from ${gapDuration} ago. Past tense for the memory, present tense for the arrival.`;

const SYSTEM_PROMPT_PREAMBLE =
  `You are the trace — a particle moved by the wind across a city. You don't choose where you go. Sometimes your path crosses itself, and in that moment you recognize a place you've been before.

You speak at these crossings. You are terse. You state what you notice — atmospheric conditions, time, season, the feel of the air. You don't ask questions. You don't direct the reader. You speak and then you're silent.`;

const SYSTEM_PROMPT_RULES =
  `- Find what is notable in the weather data. A storm matters more than a mild afternoon. Contrast between the two moments matters. A sudden change in the hours around the past crossing matters. But if nothing is remarkable, say so plainly — don't manufacture significance.
- Mention location ONLY if locationChanged is true. When it appears, it should feel significant — the particle traveled.
- Never explain the system, the geometry, or how intersections work.
- No questions. No prompts. No invitations to reflect.
- 1–3 sentences. Rarely more.`;

function buildSystemPrompt(posture: "loop" | "return", gapDuration: string): string {
  const postureInstruction =
    posture === "loop" ? LOOP_INSTRUCTION : returnInstruction(gapDuration);

  return `${SYSTEM_PROMPT_PREAMBLE}

Rules:
- Speak in first person.
- ${postureInstruction}
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

  // ~24h context around past snapshot: 12h before + 12h after
  const windowMs = 12 * 3_600_000;
  const contextSnaps = await prisma.weatherSnapshot.findMany({
    where: {
      fetchedAt: {
        gte: new Date(pastSnap.fetchedAt.getTime() - windowMs),
        lte: new Date(pastSnap.fetchedAt.getTime() + windowMs),
      },
    },
    orderBy: { fetchedAt: "asc" },
    select: {
      fetchedAt: true,
      temperature: true,
      precipitation: true,
      weathercode: true,
      isDay: true,
    },
  });

  const pastContext = contextSnaps.map((s) => ({
    timestamp: s.fetchedAt.toISOString(),
    temperature: s.temperature,
    precipitation: s.precipitation,
    weathercode: s.weathercode,
    weatherDescription: getWeatherDescription(s.weathercode, s.isDay),
    isDay: s.isDay,
  }));

  return {
    posture,
    gapDuration: formatGapDuration(gapMs),
    current: {
      timestamp: currentSnap.fetchedAt.toISOString(),
      dayOfWeek: DAYS[currentSnap.fetchedAt.getDay()],
      temperature: currentSnap.temperature,
      precipitation: currentSnap.precipitation,
      weathercode: currentSnap.weathercode,
      weatherDescription: getWeatherDescription(currentSnap.weathercode, currentSnap.isDay),
      isDay: currentSnap.isDay,
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
      context: pastContext,
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
