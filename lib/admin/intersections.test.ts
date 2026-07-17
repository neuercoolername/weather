import { describe, it, expect, vi } from "vitest";
import { getIntersectionPage, PAGE_SIZE } from "./intersections";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    intersection: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockCount = vi.mocked(prisma.intersection.count);
const mockFindMany = vi.mocked(prisma.intersection.findMany);

const MOCK_ITEMS = [{ id: 1 }, { id: 2 }] as any;

describe("getIntersectionPage", () => {
  it("queries page 1 with skip=0", async () => {
    mockCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue(MOCK_ITEMS);

    await getIntersectionPage(1);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: PAGE_SIZE })
    );
  });

  it("queries page 2 with skip=PAGE_SIZE", async () => {
    mockCount.mockResolvedValue(PAGE_SIZE + 1);
    mockFindMany.mockResolvedValue(MOCK_ITEMS);

    await getIntersectionPage(2);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: PAGE_SIZE, take: PAGE_SIZE })
    );
  });

  it("orders by detectedAt desc", async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue(MOCK_ITEMS);

    await getIntersectionPage(1);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { detectedAt: "desc" } })
    );
  });

  it("returns the items from Prisma", async () => {
    mockCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue(MOCK_ITEMS);

    const { items } = await getIntersectionPage(1);

    expect(items).toBe(MOCK_ITEMS);
  });

  it("calculates totalPages correctly", async () => {
    mockFindMany.mockResolvedValue([]);

    mockCount.mockResolvedValue(51);
    expect((await getIntersectionPage(1)).totalPages).toBe(2);

    mockCount.mockResolvedValue(50);
    expect((await getIntersectionPage(1)).totalPages).toBe(1);

    mockCount.mockResolvedValue(0);
    expect((await getIntersectionPage(1)).totalPages).toBe(0);
  });
});
