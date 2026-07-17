import { formatWindLabel } from "@/lib/compass";

interface IntersectionSummary {
  tracePointA: { snapshot: { fetchedAt: Date } };
  tracePointB: { snapshot: { fetchedAt: Date } };
}

interface Props {
  latestWind: { speedKph: number; directionDeg: number } | null;
  hoveredIntersection: IntersectionSummary | null;
  activeIntersection: IntersectionSummary | null;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TraceHeader({ latestWind, hoveredIntersection, activeIntersection }: Props) {
  const displayIntersection = hoveredIntersection ?? activeIntersection;

  let content: string | null = null;
  if (displayIntersection) {
    const a = formatDate(displayIntersection.tracePointA.snapshot.fetchedAt);
    const b = formatDate(displayIntersection.tracePointB.snapshot.fetchedAt);
    content = `${a} × ${b}`;
  } else if (latestWind) {
    content = formatWindLabel(latestWind.directionDeg, latestWind.speedKph);
  }

  if (!content) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none px-6 py-4">
      <p className={"text-2xl font-light tracking-wide"}>
        {content}
      </p>
    </div>
  );
}
