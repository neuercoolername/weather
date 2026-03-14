import { prisma } from "@/lib/prisma";

interface Point {
  x: number;
  y: number;
}

// Cartesian convention: +y = north. SVG renderer applies one y-flip at render boundary.
// North wind (0°) pushes pointer south → y decreases. South wind (180°) → y increases.
// East wind (90°) pushes west → x decreases. West wind (270°) → x increases.
export function computeTracePoint(
  prevX: number,
  prevY: number,
  windDirection: number,
  windSpeed: number
): Point {
  const rad = (windDirection * Math.PI) / 180;
  return {
    x: prevX - windSpeed * Math.sin(rad),
    y: prevY - windSpeed * Math.cos(rad),
  };
}

// Returns the intersection point of segments (p1→p2) and (p3→p4), or null.
// Uses parametric form: P = p1 + t*(p2-p1), Q = p3 + s*(p4-p3).
// Intersection exists when t and s are both strictly in (0, 1).
export function segmentsIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): Point | null {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = p4.x - p3.x;
  const dy2 = p4.y - p3.y;

  const denom = dx1 * dy2 - dy1 * dx2;
  if (denom === 0) return null; // parallel

  const dx3 = p3.x - p1.x;
  const dy3 = p3.y - p1.y;

  const t = (dx3 * dy2 - dy3 * dx2) / denom;
  const s = (dx3 * dy1 - dy3 * dx1) / denom;

  if (t <= 0 || t >= 1 || s <= 0 || s >= 1) return null;

  return {
    x: p1.x + t * dx1,
    y: p1.y + t * dy1,
  };
}

export async function detectAndStoreIntersections(
  newTracePointId: number,
  prevX: number,
  prevY: number,
  newX: number,
  newY: number
): Promise<void> {
  const allPoints = await prisma.tracePoint.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, x: true, y: true },
  });

  const newSegStart = { x: prevX, y: prevY };
  const newSegEnd = { x: newX, y: newY };

  // Build all previous segments (consecutive pairs), skip the last one
  // (it shares an endpoint with the new segment).
  const segmentCount = allPoints.length - 1;
  const intersections: { tracePointIdA: number; tracePointIdB: number; x: number; y: number }[] = [];

  for (let i = 0; i < segmentCount - 1; i++) {
    const a = allPoints[i];
    const b = allPoints[i + 1];

    const hit = segmentsIntersect(
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
      newSegStart,
      newSegEnd
    );

    if (hit) {
      intersections.push({
        tracePointIdA: b.id,
        tracePointIdB: newTracePointId,
        x: hit.x,
        y: hit.y,
      });
    }
  }

  if (intersections.length > 0) {
    await prisma.intersection.createMany({ data: intersections });
    console.log(
      `[Trace] ${intersections.length} intersection(s) detected for TracePoint #${newTracePointId}`
    );
  }
}
