import { getAllIntersectionsWithImages } from "@/lib/server/data/intersections";
import { getTracePoints } from "@/lib/server/data/trace-points";
import { getCurrentWindField } from "@/lib/server/data/wind";
import TraceSVG from "./TraceSVG";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [tracePoints, intersections, windField] = await Promise.all([
    getTracePoints(),
    getAllIntersectionsWithImages(),
    getCurrentWindField(),
  ]);

  if (tracePoints.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-zinc-500">No trace data yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen">
      <TraceSVG
        tracePoints={tracePoints}
        intersections={intersections}
        windField={windField}
      />
    </div>
  );
}
