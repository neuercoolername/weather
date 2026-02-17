import { prisma } from "@/lib/prisma";
import { generateHaiku } from "@/lib/haiku";

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    precipitation: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
    is_day: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    cloud_cover: number;
  };
}

export async function fetchAndStoreWeather(
  locationId: number,
  lat: number,
  lon: number
): Promise<void> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "precipitation",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "is_day",
    ].join(",")
  );
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Open-Meteo API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const current = (data as OpenMeteoResponse).current;

  const snapshot = await prisma.weatherSnapshot.create({
    data: {
      locationId,
      temperature: current.temperature_2m,
      precipitation: current.precipitation,
      windspeed: current.wind_speed_10m,
      weathercode: current.weather_code,
      isDay: current.is_day === 1,
      rawJson: data,
    },
  });

  console.log(
    `[WeatherCron] ${new Date().toISOString()} — Success. WeatherSnapshot #${snapshot.id} saved.`
  );

  try {
    const haikuText = await generateHaiku(data);
    await prisma.haiku.create({
      data: { snapshotId: snapshot.id, text: haikuText },
    });
    console.log(`[WeatherCron] Haiku generated for snapshot #${snapshot.id}`);
  } catch (haikuError) {
    console.error(`[WeatherCron] Failed to generate haiku for snapshot #${snapshot.id}:`, haikuError);
  }
}
