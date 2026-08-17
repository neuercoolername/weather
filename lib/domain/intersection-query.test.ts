import { describe, it, expect } from "vitest";
import {
  firstValue,
  intersectionPageHref,
  parseIntersectionFilter,
  toSearchParams,
} from "./intersection-query";

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
