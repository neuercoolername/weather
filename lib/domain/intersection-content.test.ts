import { describe, it, expect } from "vitest";
import { hasContent } from "./intersection-content";

describe("hasContent", () => {
  it("counts written text", () => {
    expect(hasContent("I was here before.", 0)).toBe(true);
  });

  it("counts an image with no text", () => {
    expect(hasContent(null, 1)).toBe(true);
  });

  it("rejects empty text with no images", () => {
    expect(hasContent("", 0)).toBe(false);
    expect(hasContent(null, 0)).toBe(false);
  });

  it("treats whitespace-only text as empty", () => {
    expect(hasContent("   \n ", 0)).toBe(false);
  });

  it("still counts an image when the text is whitespace-only", () => {
    expect(hasContent("   ", 1)).toBe(true);
  });
});
