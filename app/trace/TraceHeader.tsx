import type { WindField } from "@/lib/wind-field";
import FlowFieldHeadline from "./FlowFieldHeadline";

interface IntersectionSummary {
  tracePointA: { snapshot: { fetchedAt: Date } };
  tracePointB: { snapshot: { fetchedAt: Date } };
}

interface Props {
  windField: WindField | null;
  hoveredIntersection: IntersectionSummary | null;
  activeIntersection: IntersectionSummary | null;
}

// Compact date: D/M/YY, no leading zeros, 2-digit year (e.g. 4/4/26).
function formatCompactDate(d: Date): string {
  const dt = new Date(d);
  const yy = String(dt.getFullYear() % 100).padStart(2, "0");
  return `${dt.getDate()}/${dt.getMonth() + 1}/${yy}`;
}

export default function TraceHeader({
  windField,
  hoveredIntersection,
  activeIntersection,
}: Props) {
  const displayIntersection = hoveredIntersection ?? activeIntersection;

  // The wind reading drives the field's *motion*; the text is "Trace" by default,
  // or the crossing's two dates (compact) when an intersection is shown.
  const text = displayIntersection
    ? `${formatCompactDate(displayIntersection.tracePointA.snapshot.fetchedAt)} × ${formatCompactDate(
        displayIntersection.tracePointB.snapshot.fetchedAt
      )}`
    : "Trace";

  return (
    <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none px-6 py-4">
      <FlowFieldHeadline text={text} field={windField} />
    </div>
  );
}
