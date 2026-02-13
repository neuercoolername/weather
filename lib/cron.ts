import cron from "node-cron";
import { prisma } from "@/lib/prisma";
import { fetchAndStoreWeather } from "@/lib/weather";

export function startWeatherCron(): void {
  console.log("[WeatherCron] Initializing hourly weather fetch schedule");

  cron.schedule("0 * * * *", async () => {
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

  console.log("[WeatherCron] Scheduled: every hour at minute 0");
}
