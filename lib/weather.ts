import { prisma } from "@/lib/prisma";
import { generateHaiku } from "@/lib/haiku";
import { computeTracePoint, detectAndStoreIntersections } from "@/lib/trace";

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

async function fetchWeather(lat: number, lon: number): Promise<unknown> {
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
  return response.json();
}

async function storeSnapshot(locationId: number, data: OpenMeteoResponse) {
  const { current } = data;
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
  console.log(`[WeatherCron] ${new Date().toISOString()} — Success. WeatherSnapshot #${snapshot.id} saved.`);
  return snapshot;
}

async function storeHaiku(snapshotId: number, data: OpenMeteoResponse) {
  const text = await generateHaiku(data);
  await prisma.haiku.create({ data: { snapshotId, text } });
  console.log(`[WeatherCron] Haiku generated for snapshot #${snapshotId}`);
}

async function storeTracePoint(snapshotId: number, windDirection: number, windSpeed: number) {
  const prev = await prisma.tracePoint.findFirst({ orderBy: { createdAt: "desc" } });
  const prevX = prev?.x ?? 0;
  const prevY = prev?.y ?? 0;
  const { x, y } = computeTracePoint(prevX, prevY, windDirection, windSpeed);
  const tracePoint = await prisma.tracePoint.create({ data: { snapshotId, x, y } });
  detectAndStoreIntersections(tracePoint.id, prevX, prevY, x, y).catch((err) =>
    console.error(`[Trace] Intersection detection failed for TracePoint #${tracePoint.id}:`, err)
  );
}

export async function fetchAndStoreWeather(
  locationId: number,
  lat: number,
  lon: number
): Promise<void> {
  const data = await fetchWeather(lat, lon) as OpenMeteoResponse;
  const snapshot = await storeSnapshot(locationId, data);

  storeHaiku(snapshot.id, data).catch((err) =>
    console.error(`[WeatherCron] Failed to generate haiku for snapshot #${snapshot.id}:`, err)
  );
  storeTracePoint(snapshot.id, data.current.wind_direction_10m, data.current.wind_speed_10m).catch((err) =>
    console.error(`[Trace] Failed to store trace point for snapshot #${snapshot.id}:`, err)
  );
}
