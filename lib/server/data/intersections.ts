import "server-only";

import { prisma } from "@/lib/server/prisma";

// The intersection shape the public trace renders — derived from the query below
// (single source of truth: it follows the Prisma `select` automatically).
export type TraceIntersection = Awaited<ReturnType<typeof getAllIntersections>>[number];

export async function getAllIntersections() {
  return prisma.intersection.findMany({
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
  });
}
