import "server-only";

import { prisma } from "@/lib/server/prisma";

// The intersection shape the public trace renders — derived from the query below
// (single source of truth: it follows the Prisma `select` automatically).
export type TraceIntersection = Awaited<ReturnType<typeof getAllIntersections>>[number];

const TRACE_INTERSECTION_SELECT = {
  id: true,
  x: true,
  y: true,
  text: true,
  tracePointIdA: true,
  tracePointIdB: true,
  tracePointA: { select: { snapshot: { select: { fetchedAt: true } } } },
  tracePointB: { select: { snapshot: { select: { fetchedAt: true } } } },
} as const;

export async function getAllIntersections() {
  return prisma.intersection.findMany({ select: TRACE_INTERSECTION_SELECT });
}

/** One intersection by id, in the same shape as the trace's; null if there is none. */
export async function getIntersection(id: number) {
  return prisma.intersection.findUnique({ where: { id }, select: TRACE_INTERSECTION_SELECT });
}
