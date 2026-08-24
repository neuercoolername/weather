import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCreateSignedUrls = vi.fn();

vi.mock("@/lib/server/supabase", () => ({
  getSupabase: () => ({
    storage: { from: () => ({ createSignedUrls: mockCreateSignedUrls }) },
  }),
  bucket: () => "intersection-images",
  SIGNED_URL_EXPIRY: 86400,
}));

import { signedUrlsFor, clearSignedUrlCache } from "./image-urls";

/** Mirrors Supabase's shape: one entry per requested path, failures reported inline. */
function signs(paths: string[]) {
  return {
    data: paths.map((path) => ({
      path,
      signedUrl: `https://cdn.test/${path}?token=${Math.random()}`,
      error: null,
    })),
    error: null,
  };
}

beforeEach(() => {
  clearSignedUrlCache();
  mockCreateSignedUrls.mockReset();
  mockCreateSignedUrls.mockImplementation((paths: string[]) =>
    Promise.resolve(signs(paths))
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("signedUrlsFor", () => {
  it("signs every key in a single batched call", async () => {
    const urls = await signedUrlsFor(["a.webp", "b.webp", "c.webp"]);

    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
    expect(mockCreateSignedUrls).toHaveBeenCalledWith(
      ["a.webp", "b.webp", "c.webp"],
      86400
    );
    expect(urls.size).toBe(3);
  });

  it("deduplicates repeated keys before signing", async () => {
    await signedUrlsFor(["a.webp", "a.webp", "b.webp"]);

    expect(mockCreateSignedUrls).toHaveBeenCalledWith(["a.webp", "b.webp"], 86400);
  });

  it("returns a stable URL across calls without re-signing", async () => {
    const first = await signedUrlsFor(["a.webp"]);
    const second = await signedUrlsFor(["a.webp"]);

    expect(second.get("a.webp")).toBe(first.get("a.webp"));
    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
  });

  it("only signs the keys missing from the cache", async () => {
    await signedUrlsFor(["a.webp"]);
    await signedUrlsFor(["a.webp", "b.webp"]);

    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(2);
    expect(mockCreateSignedUrls).toHaveBeenLastCalledWith(["b.webp"], 86400);
  });

  it("skips signing entirely when everything is cached", async () => {
    await signedUrlsFor(["a.webp", "b.webp"]);
    mockCreateSignedUrls.mockClear();

    const urls = await signedUrlsFor(["b.webp", "a.webp"]);

    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
    expect(urls.size).toBe(2);
  });

  it("re-signs once the cached URL is past half its validity", async () => {
    vi.useFakeTimers();

    const first = await signedUrlsFor(["a.webp"]);
    // Cache TTL is half of SIGNED_URL_EXPIRY (86400s), so 12h.
    vi.advanceTimersByTime(12 * 60 * 60 * 1000 + 1);
    const second = await signedUrlsFor(["a.webp"]);

    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(2);
    expect(second.get("a.webp")).not.toBe(first.get("a.webp"));
  });

  it("still serves a cached URL just before the TTL elapses", async () => {
    vi.useFakeTimers();

    const first = await signedUrlsFor(["a.webp"]);
    vi.advanceTimersByTime(12 * 60 * 60 * 1000 - 1000);
    const second = await signedUrlsFor(["a.webp"]);

    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
    expect(second.get("a.webp")).toBe(first.get("a.webp"));
  });

  it("omits keys Supabase failed to sign rather than caching an empty URL", async () => {
    mockCreateSignedUrls.mockResolvedValueOnce({
      data: [
        { path: "a.webp", signedUrl: "https://cdn.test/a.webp?token=1", error: null },
        { path: "b.webp", signedUrl: null, error: "not found" },
      ],
      error: null,
    });

    const urls = await signedUrlsFor(["a.webp", "b.webp"]);

    expect(urls.get("a.webp")).toBeTruthy();
    expect(urls.has("b.webp")).toBe(false);
  });

  it("retries a previously failed key on the next call", async () => {
    mockCreateSignedUrls.mockResolvedValueOnce({
      data: [{ path: "a.webp", signedUrl: null, error: "transient" }],
      error: null,
    });

    await signedUrlsFor(["a.webp"]);
    const retry = await signedUrlsFor(["a.webp"]);

    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(2);
    expect(retry.get("a.webp")).toBeTruthy();
  });

  it("returns an empty map when signing fails outright", async () => {
    mockCreateSignedUrls.mockResolvedValueOnce({ data: null, error: "boom" });
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await signedUrlsFor(["a.webp"])).size).toBe(0);
  });

  it("makes no request for an empty key list", async () => {
    expect((await signedUrlsFor([])).size).toBe(0);
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
  });
});
