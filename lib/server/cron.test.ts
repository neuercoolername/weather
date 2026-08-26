import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import cron from "node-cron";
import { startWeatherCron } from "./cron";

vi.mock("node-cron", () => ({
  default: { schedule: vi.fn() },
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: { location: { findFirst: vi.fn() } },
}));

vi.mock("@/lib/server/weather-ingest", () => ({
  fetchAndStoreWeather: vi.fn(),
}));

const LOCAL = "postgresql://weather:weather@localhost:5433/weather";
const PROD = "postgresql://postgres:secret@aws-1-eu-central-1.pooler.supabase.com:6543/postgres";

const schedule = cron.schedule as ReturnType<typeof vi.fn>;
const savedEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...savedEnv };
  vi.restoreAllMocks();
});

describe("startWeatherCron", () => {
  it("does not schedule against a local database", () => {
    process.env.DATABASE_URL = LOCAL;
    process.env.DIRECT_URL = LOCAL;
    delete process.env.WEATHER_CRON;

    startWeatherCron();

    expect(schedule).not.toHaveBeenCalled();
  });

  it("schedules against a local database when WEATHER_CRON=1", () => {
    process.env.DATABASE_URL = LOCAL;
    process.env.DIRECT_URL = LOCAL;
    process.env.WEATHER_CRON = "1";

    startWeatherCron();

    expect(schedule).toHaveBeenCalledWith("0 * * * *", expect.any(Function));
  });

  it("schedules against production without any opt-in", () => {
    process.env.DATABASE_URL = PROD;
    process.env.DIRECT_URL = PROD;
    delete process.env.WEATHER_CRON;

    startWeatherCron();

    expect(schedule).toHaveBeenCalledWith("0 * * * *", expect.any(Function));
  });

  it("schedules when the database is only half local", () => {
    process.env.DATABASE_URL = LOCAL;
    process.env.DIRECT_URL = PROD;
    delete process.env.WEATHER_CRON;

    startWeatherCron();

    expect(schedule).toHaveBeenCalled();
  });
});
