import { describe, it, expect, vi } from "vitest";
import { sendIntersectionEmail } from "./email";

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
  it("sends without error", async () => {
    process.env.EMAIL_FROM = "trace@example.com";
    process.env.NOTIFICATION_EMAIL = "me@example.com";
    await expect(sendIntersectionEmail(BASE_ARGS)).resolves.toBeUndefined();
  });

  it("includes the admin link in the email body", async () => {
    process.env.EMAIL_FROM = "trace@example.com";
    process.env.NOTIFICATION_EMAIL = "me@example.com";
    process.env.BASE_URL = "https://example.com";
    await sendIntersectionEmail(BASE_ARGS);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          "https://example.com/admin/intersections/1"
        ),
      })
    );
  });

  it("does not double the slash when BASE_URL has a trailing one", async () => {
    process.env.EMAIL_FROM = "trace@example.com";
    process.env.NOTIFICATION_EMAIL = "me@example.com";
    process.env.BASE_URL = "https://example.com/";
    await sendIntersectionEmail(BASE_ARGS);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          "https://example.com/admin/intersections/1"
        ),
      })
    );
  });
});
