import { prisma } from "@/lib/prisma";

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    precipitation: number;
    wind_speed_10m: number;
    weather_code: number;
    is_day: number;
  };
}

export async function fetchAndStoreWeather(
  locationId: number,
  lat: number,
  lon: number
): Promise<void> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,precipitation,wind_speed_10m,weather_code,is_day`;

  const response = await fetch(url);

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
}
