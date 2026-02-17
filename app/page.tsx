import { prisma } from "@/lib/prisma";
import { getWeatherDescription } from "@/lib/wmo-codes";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await prisma.weatherSnapshot.findFirst({
    orderBy: { fetchedAt: "desc" },
    include: { location: true, haiku: true },
  });

  if (!snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-zinc-500">
          Waiting for first weather update...
        </p>
      </div>
    );
  }

  const description = getWeatherDescription(snapshot.weathercode, snapshot.isDay);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="flex flex-col items-center gap-8 p-8">
        <h1 className="text-5xl font-light tracking-tight">
          {description}
        </h1>
        <div className="flex flex-col items-center gap-2 text-xl text-zinc-500">
          <p>{snapshot.temperature}&deg;C</p>
          <p>{snapshot.precipitation} mm precipitation</p>
          <p>{snapshot.windspeed} km/h wind</p>
          <p>{snapshot.isDay ? "Day" : "Night"}</p>
        </div>
        {snapshot.haiku && (
          <p className="whitespace-pre-line text-lg italic text-zinc-400">
            {snapshot.haiku.text}
          </p>
        )}
      </main>
    </div>
  );
}
