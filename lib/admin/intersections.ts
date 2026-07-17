import { prisma } from "@/lib/prisma";

export const PAGE_SIZE = 50;

export interface IntersectionListItem {
  id: number;
  text: string | null;
  _count: { images: number };
  tracePointA: { snapshot: { fetchedAt: Date } };
  tracePointB: { snapshot: { fetchedAt: Date } };
}

export async function getIntersectionStats(): Promise<{
  total: number;
  needsText: number;
}> {
  const [total, needsText] = await Promise.all([
    prisma.intersection.count(),
    prisma.intersection.count({ where: { OR: [{ text: null }, { text: "" }] } }),
  ]);
  return { total, needsText };
}

export async function getIntersectionPage(
  page: number,
  filter?: "needs-text"
): Promise<{ items: IntersectionListItem[]; totalPages: number }> {
  const where = filter === "needs-text"
    ? { OR: [{ text: null }, { text: "" }] }
    : undefined;

  const [total, items] = await Promise.all([
    prisma.intersection.count({ where }),
    prisma.intersection.findMany({
      where,
      orderBy: { detectedAt: "desc" },
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
