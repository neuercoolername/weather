import "server-only";

// Data-access: walk the stored trace for self-crossings against the newest segment
// and persist whatever it finds. The geometry itself is pure and lives in
// lib/domain/trace-geometry; this module only supplies it with rows and writes back.

import { prisma } from "@/lib/server/prisma";
import { segmentsIntersect } from "@/lib/domain/trace-geometry";

export async function detectAndStoreIntersections(
  newTracePointId: number,
  newSnapshotId: number,
  prevX: number,
  prevY: number,
  newX: number,
  newY: number
): Promise<{ id: number; dateA: Date; dateB: Date }[]> {
  const [allPoints, newSnapshot] = await Promise.all([
    prisma.tracePoint.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        x: true,
        y: true,
        snapshot: { select: { fetchedAt: true } },
      },
    }),
    prisma.weatherSnapshot.findUniqueOrThrow({
      where: { id: newSnapshotId },
      select: { fetchedAt: true },
    }),
  ]);

  const newSegStart = { x: prevX, y: prevY };
  const newSegEnd = { x: newX, y: newY };

  // Build all previous segments (consecutive pairs), skip the last one
  // (it shares an endpoint with the new segment).
  const segmentCount = allPoints.length - 1;
  const created: { id: number; dateA: Date; dateB: Date }[] = [];

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
      const intersection = await prisma.intersection.create({
        data: {
          tracePointIdA: b.id,
          tracePointIdB: newTracePointId,
          x: hit.x,
          y: hit.y,
        },
      });
      created.push({
        id: intersection.id,
        dateA: b.snapshot.fetchedAt,
        dateB: newSnapshot.fetchedAt,
      });
    }
  }

  if (created.length > 0) {
    console.log(
      `[Trace] ${created.length} intersection(s) detected for TracePoint #${newTracePointId}`
    );
  }

  return created;
}
