import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAndStoreWeather } from "./weather-ingest";
import { computeTracePoint } from "@/lib/domain/trace-geometry";
import { prisma } from "@/lib/server/prisma";

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    weatherSnapshot: { create: vi.fn() },
    tracePoint: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/domain/trace-geometry", () => ({
  computeTracePoint: vi.fn().mockReturnValue({ x: 5, y: -3 }),
}));

vi.mock("@/lib/server/data/intersection-detection", () => ({
  detectAndStoreIntersections: vi.fn().mockResolvedValue([]),
}));

const mockWeatherData = {
  current: {
    temperature_2m: 15,
    precipitation: 0,
    wind_speed_10m: 20,
    wind_direction_10m: 180,
    wind_gusts_10m: 25,
    weather_code: 3,
    is_day: 1,
    relative_humidity_2m: 70,
    apparent_temperature: 13,
    cloud_cover: 80,
  },
};

function mockFetch(ok: boolean, data?: unknown, status = 503, statusText = "Service Unavailable") {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : status,
    statusText: ok ? "OK" : statusText,
    json: vi.fn().mockResolvedValue(data),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(data: unknown) {
  return { ok: true, status: 200, statusText: "OK", json: vi.fn().mockResolvedValue(data) };
}

function errorResponse(status: number, statusText: string) {
  return { ok: false, status, statusText, json: vi.fn() };
}

describe("fetchAndStoreWeather", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.weatherSnapshot.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 42 });
    (prisma.tracePoint.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 7, x: 5, y: -3 });
  });

  it("throws immediately when Open-Meteo returns a non-retryable error", async () => {
    mockFetch(false, undefined, 400, "Bad Request");
    await expect(fetchAndStoreWeather(1, 51.5, -0.1)).rejects.toThrow("400");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  describe("retry behavior", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("retries after 30s then 60s on a 503, and succeeds if a later attempt succeeds", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(errorResponse(503, "Service Unavailable"))
        .mockResolvedValueOnce(errorResponse(503, "Service Unavailable"))
        .mockResolvedValueOnce(jsonResponse(mockWeatherData));
      vi.stubGlobal("fetch", fetchMock);
      (prisma.tracePoint.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const promise = fetchAndStoreWeather(1, 51.5, -0.1);

      await vi.advanceTimersByTimeAsync(30_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      await promise;
      expect(prisma.weatherSnapshot.create).toHaveBeenCalledTimes(1);
    });

    it("retries on 429 responses and on network errors", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(errorResponse(429, "Too Many Requests"))
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(jsonResponse(mockWeatherData));
      vi.stubGlobal("fetch", fetchMock);
      (prisma.tracePoint.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const promise = fetchAndStoreWeather(1, 51.5, -0.1);

      await vi.advanceTimersByTimeAsync(30_000);
      await vi.advanceTimersByTimeAsync(60_000);

      await promise;
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(prisma.weatherSnapshot.create).toHaveBeenCalledTimes(1);
    });

    it("gives up after exhausting retries, leaving the last snapshot active", async () => {
      const fetchMock = vi.fn().mockResolvedValue(errorResponse(503, "Service Unavailable"));
      vi.stubGlobal("fetch", fetchMock);

      const promise = fetchAndStoreWeather(1, 51.5, -0.1);
      const assertion = expect(promise).rejects.toThrow("503");

      await vi.advanceTimersByTimeAsync(30_000);
      await vi.advanceTimersByTimeAsync(60_000);

      await assertion;
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(prisma.weatherSnapshot.create).not.toHaveBeenCalled();
    });
  });

  it("calls computeTracePoint with (0, 0) when no previous trace point exists", async () => {
    mockFetch(true, mockWeatherData);
    (prisma.tracePoint.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await fetchAndStoreWeather(1, 51.5, -0.1);

    await vi.waitFor(() => {
      expect(computeTracePoint).toHaveBeenCalledWith(0, 0, 180, 20);
    });
  });

  it("calls computeTracePoint from the previous point when one exists", async () => {
    mockFetch(true, mockWeatherData);
    (prisma.tracePoint.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 3,
      x: 12.5,
      y: -8.2,
    });

    await fetchAndStoreWeather(1, 51.5, -0.1);

    await vi.waitFor(() => {
      expect(computeTracePoint).toHaveBeenCalledWith(12.5, -8.2, 180, 20);
    });
  });
});
