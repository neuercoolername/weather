import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    intersection: { update: vi.fn() },
  },
}));

const PARAMS = Promise.resolve({ id: "5" });

function makeRequest(auth: string | null, body: object) {
  return new NextRequest("http://localhost/api/intersections/5", {
    method: "POST",
    headers: {
      ...(auth ? { authorization: auth } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/intersections/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_KEY = "secret";
  });

  it("returns 401 with no auth header", async () => {
    const res = await POST(makeRequest(null, { text: "hello" }), { params: PARAMS });
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong token", async () => {
    const res = await POST(makeRequest("Bearer wrong", { text: "hello" }), { params: PARAMS });
    expect(res.status).toBe(401);
  });

  it("updates and returns the intersection with valid auth", async () => {
    (prisma.intersection.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 5, text: "hello" });

    const res = await POST(makeRequest("Bearer secret", { text: "hello" }), { params: PARAMS });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: 5, text: "hello" });
    expect(prisma.intersection.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { text: "hello" },
      select: { id: true, text: true },
    });
  });
});
