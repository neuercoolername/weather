import { getAllIntersectionsWithImages } from "@/lib/server/data/intersections";
import { getTracePoints } from "@/lib/server/data/trace-points";
import { getCurrentWindField } from "@/lib/server/data/wind";
import { getCurrentTimeOfDay } from "@/lib/server/data/time-of-day";
import TraceSVG from "./TraceSVG";
import TimeOfDayBackdrop from "./TimeOfDayBackdrop";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [tracePoints, intersections, windField, timeOfDay] = await Promise.all([
    getTracePoints(),
    getAllIntersectionsWithImages(),
    getCurrentWindField(),
    getCurrentTimeOfDay(),
  ]);

  if (tracePoints.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <TimeOfDayBackdrop look={timeOfDay} />
        <p className="text-lg text-zinc-500">No trace data yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen">
      <TimeOfDayBackdrop look={timeOfDay} />
      <TraceSVG
        tracePoints={tracePoints}
        intersections={intersections}
        windField={windField}
      />
    </div>
  );
}
