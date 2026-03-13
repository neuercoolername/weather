import { prisma } from "@/lib/prisma";
import TraceSVG from "./TraceSVG";

export const dynamic = "force-dynamic";

export default async function TracePage() {
  const [tracePoints, intersections] = await Promise.all([
    prisma.tracePoint.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        x: true,
        y: true,
        snapshot: { select: { fetchedAt: true } },
      },
    }),
    prisma.intersection.findMany({
      select: {
        id: true,
        x: true,
        y: true,
        text: true,
        tracePointIdA: true,
        tracePointIdB: true,
        tracePointA: { select: { snapshot: { select: { fetchedAt: true } } } },
        tracePointB: { select: { snapshot: { select: { fetchedAt: true } } } },
      },
    }),
  ]);

  if (tracePoints.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-zinc-500">No trace data yet.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <TraceSVG tracePoints={tracePoints} intersections={intersections} />
    </div>
  );
}
