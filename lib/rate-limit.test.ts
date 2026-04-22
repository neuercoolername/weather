import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

// Each test gets a fresh module so the in-memory store is empty
beforeEach(() => {
  vi.resetModules();
});

describe("checkRateLimit", () => {
  it("allows the first attempt", () => {
    expect(checkRateLimit("1.2.3.4").allowed).toBe(true);
  });

  it("allows attempts 2 through 5", () => {
    for (let i = 0; i < 4; i++) {
      expect(checkRateLimit("1.2.3.4").allowed).toBe(true);
    }
  });

  it("blocks the 6th attempt from the same IP", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4");
    expect(checkRateLimit("1.2.3.4").allowed).toBe(false);
  });

  it("tracks different IPs independently", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4");
    expect(checkRateLimit("1.2.3.4").allowed).toBe(false);
    expect(checkRateLimit("9.9.9.9").allowed).toBe(true);
  });

  it("resets the counter after the window expires", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4");
    expect(checkRateLimit("1.2.3.4").allowed).toBe(false);

    // Advance past the 15-minute window
    vi.spyOn(Date, "now").mockReturnValue(now + 15 * 60 * 1000 + 1);
    expect(checkRateLimit("1.2.3.4").allowed).toBe(true);

    vi.restoreAllMocks();
  });
});

describe("resetRateLimit", () => {
  it("clears the counter so a blocked IP becomes allowed again", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4");
    expect(checkRateLimit("1.2.3.4").allowed).toBe(false);

    resetRateLimit("1.2.3.4");
    expect(checkRateLimit("1.2.3.4").allowed).toBe(true);
  });
});
