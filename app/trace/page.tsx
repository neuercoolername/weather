import { prisma } from "@/lib/prisma";
import { getAllIntersectionsWithImages } from "@/lib/intersections";
import TraceSVG from "./TraceSVG";

export const dynamic = "force-dynamic";

export default async function TracePage() {
  const [tracePoints, intersections, latestSnapshot] = await Promise.all([
    prisma.tracePoint.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        x: true,
        y: true,
        snapshot: { select: { fetchedAt: true } },
      },
    }),
    getAllIntersectionsWithImages(),
    prisma.weatherSnapshot.findFirst({
      orderBy: { fetchedAt: "desc" },
      select: { windspeed: true, rawJson: true },
    }),
  ]);

  if (tracePoints.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-zinc-500">No trace data yet.</p>
      </div>
    );
  }

  const rawJson = latestSnapshot?.rawJson as { current?: { wind_direction_10m?: number } } | null;
  const latestWind = latestSnapshot
    ? {
        speedKph: latestSnapshot.windspeed,
        directionDeg: rawJson?.current?.wind_direction_10m ?? 0,
      }
    : null;

  return (
    <div className="w-full h-screen">
      <TraceSVG
        tracePoints={tracePoints}
        intersections={intersections}
        latestWind={latestWind}
      />
    </div>
  );
}
