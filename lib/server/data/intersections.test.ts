import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdjacentIntersectionIds } from "./intersections";

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    intersection: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/server/supabase", () => ({
  getSupabase: vi.fn(),
  BUCKET: "intersection-images",
  SIGNED_URL_EXPIRY: 3600,
}));

import { prisma } from "@/lib/server/prisma";

const mockFindFirst = vi.mocked(prisma.intersection.findFirst);

const DETECTED_AT = new Date("2026-03-14T10:58:53.919Z");

beforeEach(() => {
  mockFindFirst.mockReset();
});

describe("getAdjacentIntersectionIds", () => {
  it("walks forward past rows sharing the same detectedAt", async () => {
    mockFindFirst.mockResolvedValue(null as never);

    await getAdjacentIntersectionIds(9, DETECTED_AT);

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { detectedAt: { gt: DETECTED_AT } },
          { detectedAt: DETECTED_AT, id: { gt: 9 } },
        ],
      },
      orderBy: [{ detectedAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
  });

  it("walks backward past rows sharing the same detectedAt", async () => {
    mockFindFirst.mockResolvedValue(null as never);

    await getAdjacentIntersectionIds(9, DETECTED_AT);

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { detectedAt: { lt: DETECTED_AT } },
          { detectedAt: DETECTED_AT, id: { lt: 9 } },
        ],
      },
      orderBy: [{ detectedAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
  });

  it("returns the neighbouring ids", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id: 10 } as never)
      .mockResolvedValueOnce({ id: 8 } as never);

    expect(await getAdjacentIntersectionIds(9, DETECTED_AT)).toEqual({
      prevId: 10,
      nextId: 8,
    });
  });

  it("returns null at the ends of the range", async () => {
    mockFindFirst.mockResolvedValue(null as never);

    expect(await getAdjacentIntersectionIds(9, DETECTED_AT)).toEqual({
      prevId: null,
      nextId: null,
    });
  });
});
