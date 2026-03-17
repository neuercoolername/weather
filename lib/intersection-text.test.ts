import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatGapDuration, buildIntersectionPayload, generateIntersectionText } from "./intersection-text";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    intersection: { findUniqueOrThrow: vi.fn() },
    weatherSnapshot: { findMany: vi.fn() },
    intersectionText: { create: vi.fn() },
  },
}));

const mockAnthropicCreate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    content: [{ type: "text", text: "  I was here before.  " }],
  })
);

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockAnthropicCreate };
  },
}));

import { prisma } from "@/lib/prisma";

// Jan 1 2026 12:00 UTC (past) and Jan 1 2026 18:00 UTC (current) — 6h gap → loop
const PAST_FETCHED_AT = new Date("2026-01-01T12:00:00.000Z");
const CURRENT_FETCHED_AT = new Date("2026-01-01T18:00:00.000Z");

// Jan 1 (past) and Jan 10 (current) — 9 days gap → return
const PAST_FETCHED_AT_OLD = new Date("2026-01-01T12:00:00.000Z");
const CURRENT_FETCHED_AT_OLD = new Date("2026-01-10T12:00:00.000Z");

function makeIntersection(pastFetchedAt: Date, currentFetchedAt: Date) {
  return {
    id: 1,
    tracePointA: {
      snapshot: {
        fetchedAt: pastFetchedAt,
        temperature: 5.0,
        precipitation: 0.0,
        weathercode: 3,
        isDay: true,
        location: { lat: 52.52, lon: 13.405 },
      },
    },
    tracePointB: {
      snapshot: {
        fetchedAt: currentFetchedAt,
        temperature: 8.5,
        precipitation: 1.2,
        weathercode: 61,
        isDay: false,
        location: { lat: 52.52, lon: 13.405 },
      },
    },
  };
}

const MOCK_CONTEXT_SNAPS = [
  {
    fetchedAt: new Date("2026-01-01T06:00:00.000Z"),
    temperature: 4.0,
    precipitation: 0.0,
    weathercode: 2,
    isDay: true,
  },
  {
    fetchedAt: new Date("2026-01-01T12:00:00.000Z"),
    temperature: 5.0,
    precipitation: 0.0,
    weathercode: 3,
    isDay: true,
  },
];

describe("formatGapDuration", () => {
  it("formats short gaps as minutes", () => {
    expect(formatGapDuration(30 * 60_000)).toBe("30 minutes");
  });

  it("formats gaps under 48h as hours", () => {
    expect(formatGapDuration(6 * 3_600_000)).toBe("6 hours");
    expect(formatGapDuration(36 * 3_600_000)).toBe("36 hours");
  });

  it("formats gaps under 14 days as days", () => {
    expect(formatGapDuration(2 * 86_400_000)).toBe("2 days");
    expect(formatGapDuration(10 * 86_400_000)).toBe("10 days");
  });

  it("formats gaps under 60 days as weeks", () => {
    expect(formatGapDuration(42 * 86_400_000)).toBe("6 weeks");
  });

  it("formats gaps under 365 days as months", () => {
    expect(formatGapDuration(180 * 86_400_000)).toBe("6 months");
  });

  it("formats gaps around a year as 'almost a year'", () => {
    expect(formatGapDuration(400 * 86_400_000)).toBe("almost a year");
  });

  it("formats multi-year gaps", () => {
    expect(formatGapDuration(800 * 86_400_000)).toBe("about 2 years");
  });
});

describe("buildIntersectionPayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.weatherSnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      MOCK_CONTEXT_SNAPS
    );
  });

  it("classifies a short gap as 'loop'", async () => {
    (prisma.intersection.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeIntersection(PAST_FETCHED_AT, CURRENT_FETCHED_AT)
    );

    const payload = await buildIntersectionPayload(1);
    expect(payload.posture).toBe("loop");
  });

  it("classifies a long gap as 'return'", async () => {
    (prisma.intersection.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeIntersection(PAST_FETCHED_AT_OLD, CURRENT_FETCHED_AT_OLD)
    );

    const payload = await buildIntersectionPayload(1);
    expect(payload.posture).toBe("return");
  });

  it("computes a human-readable gapDuration", async () => {
    (prisma.intersection.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeIntersection(PAST_FETCHED_AT, CURRENT_FETCHED_AT)
    );

    const payload = await buildIntersectionPayload(1);
    expect(payload.gapDuration).toBe("6 hours");
  });

  it("queries the context window with a 12h range around the past snapshot", async () => {
    (prisma.intersection.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeIntersection(PAST_FETCHED_AT, CURRENT_FETCHED_AT)
    );

    await buildIntersectionPayload(1);

    expect(prisma.weatherSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          fetchedAt: {
            gte: new Date(PAST_FETCHED_AT.getTime() - 12 * 3_600_000),
            lte: new Date(PAST_FETCHED_AT.getTime() + 12 * 3_600_000),
          },
        },
      })
    );
  });

  it("includes weather descriptions resolved from weathercode", async () => {
    (prisma.intersection.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeIntersection(PAST_FETCHED_AT, CURRENT_FETCHED_AT)
    );

    const payload = await buildIntersectionPayload(1);
    // weathercode 3 + isDay true → "Cloudy"
    expect(payload.past.weatherDescription).toBe("Cloudy");
    // weathercode 61 + isDay false → "Light Rain"
    expect(payload.current.weatherDescription).toBe("Light Rain");
  });

  it("always sets locationChanged to false (MVP)", async () => {
    (prisma.intersection.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeIntersection(PAST_FETCHED_AT, CURRENT_FETCHED_AT)
    );

    const payload = await buildIntersectionPayload(1);
    expect(payload.locationChanged).toBe(false);
  });
});

describe("generateIntersectionText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.intersection.findUniqueOrThrow as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeIntersection(PAST_FETCHED_AT, CURRENT_FETCHED_AT)
    );
    (prisma.weatherSnapshot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      MOCK_CONTEXT_SNAPS
    );
    (prisma.intersectionText.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
  });

  it("returns trimmed text from the LLM", async () => {
    const text = await generateIntersectionText(1);
    expect(text).toBe("I was here before.");
  });

  it("stores the IntersectionText record with the prompt payload", async () => {
    await generateIntersectionText(1);

    expect(prisma.intersectionText.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          intersectionId: 1,
          text: "I was here before.",
          promptPayload: expect.objectContaining({ posture: "loop" }),
        }),
      })
    );
  });
});
