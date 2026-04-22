import { describe, it, expect, vi } from "vitest";
import { formatDate, sendIntersectionEmail } from "./email";

const mockSend = vi.fn().mockResolvedValue({});

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

const BASE_ARGS = {
  id: 1,
  dateA: new Date("2026-02-18T13:00:00.000Z"),
  dateB: new Date("2026-02-18T19:00:00.000Z"),
};

describe("sendIntersectionEmail", () => {
  it("sends without error when no text is provided", async () => {
    process.env.EMAIL_FROM = "trace@example.com";
    process.env.NOTIFICATION_EMAIL = "me@example.com";
    await expect(sendIntersectionEmail(BASE_ARGS)).resolves.toBeUndefined();
  });

  it("sends without error when text is provided", async () => {
    process.env.EMAIL_FROM = "trace@example.com";
    process.env.NOTIFICATION_EMAIL = "me@example.com";
    await expect(
      sendIntersectionEmail({ ...BASE_ARGS, text: "I was here before." })
    ).resolves.toBeUndefined();
  });

  it("includes the admin link in the email body", async () => {
    process.env.EMAIL_FROM = "trace@example.com";
    process.env.NOTIFICATION_EMAIL = "me@example.com";
    process.env.BASE_URL = "https://example.com";
    await sendIntersectionEmail(BASE_ARGS);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("/admin/intersections/1"),
      })
    );
  });
});

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
