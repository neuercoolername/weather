import { describe, it, expect } from "vitest";
import {
  BEAUFORT_PHRASES,
  beaufortForce,
  closestPhrase,
  randomPhrase,
  type BeaufortPhrase,
} from "./beaufort";

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

describe("beaufortForce", () => {
  it("maps km/h onto the scale's force numbers", () => {
    expect(beaufortForce(0)).toBe(0);
    expect(Math.round(beaufortForce(3))).toBe(1); // light air
    expect(Math.round(beaufortForce(15))).toBe(3); // gentle breeze
    expect(Math.round(beaufortForce(55))).toBe(7); // near gale
    expect(Math.round(beaufortForce(120))).toBe(12); // hurricane
  });

  it("keeps the fraction and clamps to 0–12", () => {
    expect(beaufortForce(15) % 1).not.toBe(0);
    expect(beaufortForce(500)).toBe(12);
    expect(beaufortForce(-5)).toBe(0);
  });
});

describe("closestPhrase", () => {
  const phrase = (text: string, force: number): BeaufortPhrase => ({ text, force, group: "land" });

  it("picks only among the phrases on the nearest force", () => {
    const list = [phrase("A", 5), phrase("B", 6), phrase("C", 6), phrase("D", 7)];
    expect(closestPhrase(6.2, () => 0, list).text).toBe("B");
    expect(closestPhrase(6.2, () => 0.999999, list).text).toBe("C");
  });

  it("resolves a gap to whichever side the speed is nearer", () => {
    const list = [phrase("Seven", 7), phrase("Nine", 9)];
    expect(closestPhrase(7.9, () => 0, list).text).toBe("Seven");
    expect(closestPhrase(8.1, () => 0, list).text).toBe("Nine");
  });

  it("falls back to the strongest phrase above the list's top force", () => {
    const top = Math.max(...BEAUFORT_PHRASES.map((p) => p.force));
    expect(closestPhrase(12).force).toBe(top);
  });

  it("finds a phrase for every force on the scale", () => {
    for (let f = 0; f <= 12; f++) {
      expect(BEAUFORT_PHRASES).toContain(closestPhrase(f));
    }
  });
});
