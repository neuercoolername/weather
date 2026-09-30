import { getAllIntersectionsWithImages } from "@/lib/server/data/intersections";
import { getTracePoints } from "@/lib/server/data/trace-points";
import { getCurrentWindField } from "@/lib/server/data/wind";
import { getCurrentTimeOfDay } from "@/lib/server/data/time-of-day";
import { randomPhrase } from "@/lib/domain/beaufort";
import { aboutMeta } from "@/lib/domain/about";
import { hasContent } from "@/lib/domain/intersection-content";
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

  // Formatted here rather than in the browser, so the server and client render the same text.
  const since = new Date(
    Math.min(...tracePoints.map((p) => new Date(p.snapshot.fetchedAt).getTime()))
  );
  const meta = aboutMeta(
    since,
    tracePoints.length,
    intersections.filter((ix) => hasContent(ix.text)).length
  );

  return (
    <div className="w-full h-screen">
      <TimeOfDayBackdrop look={timeOfDay} />
      <TraceSVG
        tracePoints={tracePoints}
        intersections={intersections}
        windField={windField}
        phrase={randomPhrase().text}
        aboutMeta={meta}
      />
    </div>
  );
}
