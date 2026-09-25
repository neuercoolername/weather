import { describe, it, expect } from "vitest";
import { hasContent } from "./intersection-content";

describe("hasContent", () => {
  it("counts written text", () => {
    expect(hasContent("I was here before.")).toBe(true);
  });

  it("rejects empty text", () => {
    expect(hasContent("")).toBe(false);
    expect(hasContent(null)).toBe(false);
  });

  it("treats whitespace-only text as empty", () => {
    expect(hasContent("   \n ")).toBe(false);
  });
});
