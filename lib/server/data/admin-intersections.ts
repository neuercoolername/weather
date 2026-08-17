import "server-only";

// Data-access for the admin intersection queue. The pure searchParam/href helpers
// that decide *what* to query live in lib/domain/intersection-query.

import { prisma } from "@/lib/server/prisma";
import type { IntersectionFilter } from "@/lib/domain/intersection-query";

export const PAGE_SIZE = 50;

// An intersection counts as done once it has text *or* at least one image. This is
// the inverse of hasContent() in lib/domain/intersection-content.ts, which gates the
// public trace — evaluated in SQL rather than JS, so the two are kept in step by hand.
const NEEDS_CONTENT = {
  AND: [{ OR: [{ text: null }, { text: "" }] }, { images: { none: {} } }],
};

export interface IntersectionListItem {
  id: number;
  text: string | null;
  _count: { images: number };
  tracePointA: { snapshot: { fetchedAt: Date } };
  tracePointB: { snapshot: { fetchedAt: Date } };
}

export async function getIntersectionStats(): Promise<{
  total: number;
  needsContent: number;
}> {
  const [total, needsContent] = await Promise.all([
    prisma.intersection.count(),
    prisma.intersection.count({ where: NEEDS_CONTENT }),
  ]);
  return { total, needsContent };
}

export async function getIntersectionPage(
  page: number,
  filter?: IntersectionFilter
): Promise<{ items: IntersectionListItem[]; totalPages: number }> {
  const where = filter === "needs-content" ? NEEDS_CONTENT : undefined;

  const [total, items] = await Promise.all([
    prisma.intersection.count({ where }),
    prisma.intersection.findMany({
      where,
      // id is the tiebreaker: several intersections can share a detectedAt
      // (lib/server/data/intersection-detection.ts creates them in a loop), and
      // offset pagination would otherwise repeat or skip tied rows across pages.
      orderBy: [{ detectedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        text: true,
        _count: { select: { images: true } },
        tracePointA: { select: { snapshot: { select: { fetchedAt: true } } } },
        tracePointB: { select: { snapshot: { select: { fetchedAt: true } } } },
      },
    }),
  ]);

  return { items, totalPages: Math.ceil(total / PAGE_SIZE) };
}
