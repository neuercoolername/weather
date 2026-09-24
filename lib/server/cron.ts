import "server-only";

import cron from "node-cron";
import { prisma } from "@/lib/server/prisma";
import { describeTargets, isLocalDatabase } from "@/lib/server/env-guard";
import { fetchAndStoreWeather } from "@/lib/server/weather-ingest";

/** Runs the schedule against a local database anyway. */
const LOCAL_OVERRIDE = "WEATHER_CRON";

export function startWeatherCron(): void {
  // Keys on the resolved database rather than NODE_ENV, and defaults to *on*: production needs no
  // new variable, because an unset one there would stop ingest and a stalled trace fails silently.
  if (isLocalDatabase() && process.env[LOCAL_OVERRIDE] !== "1") {
    console.log(
      `[WeatherCron] Local database — not scheduling.\n${describeTargets()}\n` +
        `Set ${LOCAL_OVERRIDE}=1 to run the hourly fetch against it.`
    );
    return;
  }

  console.log("[WeatherCron] Initializing hourly weather fetch schedule");

  cron.schedule("7 * * * *", async () => {
    const now = new Date().toISOString();

    const location = await prisma.location.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!location) {
      console.log(`[WeatherCron] ${now} — No location found, skipping fetch`);
      return;
    }

    console.log(
      `[WeatherCron] ${now} — Fetching weather for Location #${location.id} (lat: ${location.lat}, lon: ${location.lon})`
    );

    try {
      await fetchAndStoreWeather(location.id, location.lat, location.lon);
    } catch (error) {
      console.error(
        `[WeatherCron] ${now} — ERROR: Open-Meteo request failed. Last snapshot remains active.`,
        error
      );
    }
  });

  console.log("[WeatherCron] Scheduled: every hour at minute 7");
}
