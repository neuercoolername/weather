// Data-access: the ordered trace points for the public trace view.

import { prisma } from "@/lib/prisma";

export interface TracePoint {
  id: number;
  x: number;
  y: number;
  snapshot: { fetchedAt: Date };
}

/** All trace points in chronological order. */
export async function getTracePoints(): Promise<TracePoint[]> {
  return prisma.tracePoint.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      x: true,
      y: true,
      snapshot: { select: { fetchedAt: true } },
    },
  });
}
