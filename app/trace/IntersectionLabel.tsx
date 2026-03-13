interface Intersection {
  id: number;
  text: string | null;
  tracePointA: { snapshot: { fetchedAt: Date } };
  tracePointB: { snapshot: { fetchedAt: Date } };
}

interface Props {
  sx: number;
  sy: number;
  intersection: Intersection;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function IntersectionLabel({ sx, sy, intersection }: Props) {
  const dateLabel = `${formatDate(intersection.tracePointA.snapshot.fetchedAt)} × ${formatDate(intersection.tracePointB.snapshot.fetchedAt)}`;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        transform: `translate(${sx + 12}px, ${sy - 20}px)`,
        pointerEvents: "none",
      }}
      className="text-xs text-zinc-500 leading-relaxed"
    >
      <p>{dateLabel}</p>
      {intersection.text && <p className="mt-1">{intersection.text}</p>}
    </div>
  );
}
