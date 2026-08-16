import { describe, it, expect, vi } from "vitest";
import {
  firstValue,
  getIntersectionPage,
  intersectionPageHref,
  parseIntersectionFilter,
  toSearchParams,
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

describe("firstValue", () => {
  it("passes a plain string through", () => {
    expect(firstValue("a")).toBe("a");
    expect(firstValue(undefined)).toBeUndefined();
  });

  it("takes the first entry of a repeated param", () => {
    expect(firstValue(["a", "b"])).toBe("a");
  });

  it("returns undefined for an empty array", () => {
    expect(firstValue([])).toBeUndefined();
  });
});

describe("toSearchParams", () => {
  it("collapses a repeated param to its first value", () => {
    const params = toSearchParams({ filter: ["needs-content", "nonsense"] });
    expect(params.get("filter")).toBe("needs-content");
    expect(params.getAll("filter")).toEqual(["needs-content"]);
  });

  it("drops empty and undefined values", () => {
    const params = toSearchParams({ filter: "", page: undefined, q: "x" });
    expect(params.has("filter")).toBe(false);
    expect(params.has("page")).toBe(false);
    expect(params.get("q")).toBe("x");
  });
});

describe("parseIntersectionFilter", () => {
  it("accepts the known filter", () => {
    expect(parseIntersectionFilter("needs-content")).toBe("needs-content");
  });

  it("treats anything else as unfiltered", () => {
    expect(parseIntersectionFilter(undefined)).toBeUndefined();
    expect(parseIntersectionFilter(null)).toBeUndefined();
    expect(parseIntersectionFilter("")).toBeUndefined();
    expect(parseIntersectionFilter("needs-text")).toBeUndefined();
    expect(parseIntersectionFilter("nonsense")).toBeUndefined();
  });
});

describe("intersectionPageHref", () => {
  // Key order depends on whether `page` was already in the query, so assert on
  // the parsed result rather than the exact string.
  const parse = (href: string) => {
    const [path, query] = href.split("?");
    expect(path).toBe("/admin/intersections");
    return new URLSearchParams(query);
  };

  it("carries only page when the query is empty", () => {
    expect(intersectionPageHref(2, "")).toBe("/admin/intersections?page=2");
  });

  it("overrides an existing page rather than appending one", () => {
    const params = parse(intersectionPageHref(3, "page=2"));
    expect(params.getAll("page")).toEqual(["3"]);
  });

  it("preserves the filter in both directions", () => {
    const older = parse(intersectionPageHref(3, "page=2&filter=needs-content"));
    expect(older.get("page")).toBe("3");
    expect(older.get("filter")).toBe("needs-content");

    const newer = parse(intersectionPageHref(1, "page=2&filter=needs-content"));
    expect(newer.get("page")).toBe("1");
    expect(newer.get("filter")).toBe("needs-content");
  });

  it("preserves an unrelated param", () => {
    const params = parse(intersectionPageHref(2, "filter=needs-content&q=west"));
    expect(params.get("page")).toBe("2");
    expect(params.get("filter")).toBe("needs-content");
    expect(params.get("q")).toBe("west");
  });
});
