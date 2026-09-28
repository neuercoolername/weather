import { describe, it, expect } from "vitest";
import { DEFAULT_HEADLINE_LAYOUT, isCompactHeadline } from "./headline-layout";

describe("isCompactHeadline", () => {
  const params = { ...DEFAULT_HEADLINE_LAYOUT, compactMaxWidth: 1024 };

  it("is compact below the width threshold", () => {
    expect(isCompactHeadline(390, false, params)).toBe(true);
    expect(isCompactHeadline(1023, false, params)).toBe(true);
    expect(isCompactHeadline(1024, false, params)).toBe(false);
  });

  // An iPad Pro in landscape is wider than the threshold but still has no hover.
  it("is compact on a device without hover, however wide", () => {
    expect(isCompactHeadline(1366, true, params)).toBe(true);
  });
});
