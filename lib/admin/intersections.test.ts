import { describe, it, expect, vi } from "vitest";
import {
  getIntersectionPage,
  intersectionPageHref,
  PAGE_SIZE,
} from "./intersections";

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

  it("filters on empty or null text for needs-text", async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue(MOCK_ITEMS);

    await getIntersectionPage(1, "needs-text");

    const where = { OR: [{ text: null }, { text: "" }] };
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(mockCount).toHaveBeenCalledWith({ where });
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

    await getIntersectionPage(2, "needs-text");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ text: null }, { text: "" }] },
        skip: PAGE_SIZE,
      })
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

describe("intersectionPageHref", () => {
  it("carries only page when unfiltered", () => {
    expect(intersectionPageHref(2)).toBe("/admin/intersections?page=2");
  });

  it("preserves the filter on both directions", () => {
    expect(intersectionPageHref(3, "needs-text")).toBe(
      "/admin/intersections?page=3&filter=needs-text"
    );
    expect(intersectionPageHref(1, "needs-text")).toBe(
      "/admin/intersections?page=1&filter=needs-text"
    );
  });
});
