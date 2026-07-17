import { describe, it, expect } from "vitest";
import { degreesToCompassPoint, formatWindLabel } from "./compass";

describe("degreesToCompassPoint", () => {
  it("0° → N", () => expect(degreesToCompassPoint(0)).toBe("N"));
  it("45° → NE", () => expect(degreesToCompassPoint(45)).toBe("NE"));
  it("90° → E", () => expect(degreesToCompassPoint(90)).toBe("E"));
  it("135° → SE", () => expect(degreesToCompassPoint(135)).toBe("SE"));
  it("180° → S", () => expect(degreesToCompassPoint(180)).toBe("S"));
  it("225° → SW", () => expect(degreesToCompassPoint(225)).toBe("SW"));
  it("270° → W", () => expect(degreesToCompassPoint(270)).toBe("W"));
  it("315° → NW", () => expect(degreesToCompassPoint(315)).toBe("NW"));
  it("360° wraps to N", () => expect(degreesToCompassPoint(360)).toBe("N"));
  it("337° rounds to NW (sector boundary at 337.5°)", () => expect(degreesToCompassPoint(337)).toBe("NW"));
  it("338° rounds to N", () => expect(degreesToCompassPoint(338)).toBe("N"));
  it("negative degrees: -45° → NW", () => expect(degreesToCompassPoint(-45)).toBe("NW"));
});

describe("formatWindLabel", () => {
  it("rounds speed and formats direction", () =>
    expect(formatWindLabel(315, 14.3)).toBe("NW 14 km/h"));
  it("rounds up correctly", () =>
    expect(formatWindLabel(90, 7.6)).toBe("E 8 km/h"));
});
