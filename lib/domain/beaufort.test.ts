import { describe, it, expect } from "vitest";
import { BEAUFORT_PHRASES, randomPhrase } from "./beaufort";

describe("BEAUFORT_PHRASES", () => {
  it("holds no phrase twice", () => {
    const texts = BEAUFORT_PHRASES.map((p) => p.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  // The phrase is the headline as-is: sentence case, single spaces, no trailing punctuation.
  it("writes every phrase as a sentence-case headline", () => {
    for (const { text } of BEAUFORT_PHRASES) {
      expect(text).toMatch(/^[A-Z][a-z-]*( [a-z-]+)*$/);
    }
  });
});

describe("randomPhrase", () => {
  it("covers the list from first to last", () => {
    expect(randomPhrase(() => 0)).toBe(BEAUFORT_PHRASES[0]);
    expect(randomPhrase(() => 0.999999)).toBe(BEAUFORT_PHRASES[BEAUFORT_PHRASES.length - 1]);
  });
});
