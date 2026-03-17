import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAndStoreWeather } from "./weather";
import { computeTracePoint } from "@/lib/trace";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    weatherSnapshot: { create: vi.fn() },
    tracePoint: { findFirst: vi.fn(), create: vi.fn() },
    haiku: { create: vi.fn() },
  },
}));

vi.mock("@/lib/haiku", () => ({
  generateHaiku: vi.fn().mockResolvedValue("mock haiku"),
}));

vi.mock("@/lib/trace", () => ({
  computeTracePoint: vi.fn().mockReturnValue({ x: 5, y: -3 }),
  detectAndStoreIntersections: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/intersection-text", () => ({
  generateIntersectionText: vi.fn().mockResolvedValue("mock intersection text"),
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

function mockFetch(ok: boolean, data?: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 503,
      statusText: ok ? "OK" : "Service Unavailable",
      json: vi.fn().mockResolvedValue(data),
    })
  );
}

describe("fetchAndStoreWeather", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.weatherSnapshot.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 42 });
    (prisma.tracePoint.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 7, x: 5, y: -3 });
  });

  it("throws when Open-Meteo returns a non-OK response", async () => {
    mockFetch(false);
    await expect(fetchAndStoreWeather(1, 51.5, -0.1)).rejects.toThrow("503");
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
