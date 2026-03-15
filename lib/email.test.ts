import { describe, it, expect } from "vitest";
import { formatDate } from "./email";

describe("formatDate", () => {
  it("formats a winter date correctly (UTC+1)", () => {
    // 2026-02-18 13:00 UTC = 14:00 Berlin (UTC+1 in winter)
    const date = new Date("2026-02-18T13:00:00.000Z");
    expect(formatDate(date)).toBe("Wednesday, 18 Feb 2026, 14:00");
  });

  it("formats a summer date correctly (UTC+2)", () => {
    // 2026-07-07 12:00 UTC = 14:00 Berlin (UTC+2 in summer)
    const date = new Date("2026-07-07T12:00:00.000Z");
    expect(formatDate(date)).toBe("Tuesday, 7 Jul 2026, 14:00");
  });

  it("does not include AM or PM", () => {
    const date = new Date("2026-02-18T13:00:00.000Z");
    const result = formatDate(date);
    expect(result).not.toMatch(/AM|PM/i);
  });
});
