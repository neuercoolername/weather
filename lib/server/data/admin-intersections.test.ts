import { describe, it, expect, vi } from "vitest";
import { getIntersectionPage, PAGE_SIZE } from "./admin-intersections";

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    intersection: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/server/prisma";

const mockCount = vi.mocked(prisma.intersection.count);
const mockFindMany = vi.mocked(prisma.intersection.findMany);

const MOCK_ITEMS = [{ id: 1 }, { id: 2 }] as unknown as Awaited<
  ReturnType<typeof prisma.intersection.findMany>
>;

const NEEDS_CONTENT_WHERE = {
  AND: [{ OR: [{ text: null }, { text: "" }] }, { images: { none: {} } }],
};

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

  it("orders by detectedAt desc, with id as tiebreaker", async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue(MOCK_ITEMS);

    await getIntersectionPage(1);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ detectedAt: "desc" }, { id: "desc" }],
      })
    );
  });

  it("applies no where clause when unfiltered", async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue(MOCK_ITEMS);

    await getIntersectionPage(1);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined })
    );
    expect(mockCount).toHaveBeenCalledWith({ where: undefined });
  });

  it("filters on missing text AND no images for needs-content", async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue(MOCK_ITEMS);

    await getIntersectionPage(1, "needs-content");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: NEEDS_CONTENT_WHERE })
    );
    expect(mockCount).toHaveBeenCalledWith({ where: NEEDS_CONTENT_WHERE });
  });

  it("returns the items from Prisma", async () => {
    mockCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue(MOCK_ITEMS);

    const { items } = await getIntersectionPage(1);

    expect(items).toBe(MOCK_ITEMS);
  });

  it("passes the filter through to a later page", async () => {
    mockCount.mockResolvedValue(PAGE_SIZE + 1);
    mockFindMany.mockResolvedValue(MOCK_ITEMS);

    await getIntersectionPage(2, "needs-content");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: NEEDS_CONTENT_WHERE, skip: PAGE_SIZE })
    );
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
