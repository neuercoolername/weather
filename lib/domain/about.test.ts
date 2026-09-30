import { describe, it, expect } from "vitest";
import { aboutMeta } from "./about";

describe("aboutMeta", () => {
  it("reads as start date, hours and crossings", () => {
    expect(aboutMeta(new Date("2026-02-17T16:17:38Z"), 4558, 140)).toBe(
      "17 Feb 2026 – now · 4,558 hours · 140 crossings"
    );
  });

  it("dates the start in Berlin, not the server's zone", () => {
    // 23:30 UTC on 16 Feb is already 17 Feb in Berlin
    expect(aboutMeta(new Date("2026-02-16T23:30:00Z"), 1, 0)).toMatch(/^17 Feb 2026/);
  });

  it("counts zero crossings plainly", () => {
    expect(aboutMeta(new Date("2026-02-17T12:00:00Z"), 12, 0)).toBe(
      "17 Feb 2026 – now · 12 hours · 0 crossings"
    );
  });
});
