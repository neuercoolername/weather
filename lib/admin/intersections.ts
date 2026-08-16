import { prisma } from "@/lib/prisma";

export const PAGE_SIZE = 50;

export type IntersectionFilter = "needs-content";

// An intersection counts as done once it has text *or* at least one image.
const NEEDS_CONTENT = {
  AND: [{ OR: [{ text: null }, { text: "" }] }, { images: { none: {} } }],
};

// Next delivers a repeated param (?a=1&a=2) as an array; take the first and ignore
// the rest, so a hand-edited URL degrades to one well-defined value.
export function firstValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Collapses Next's raw searchParams into a single-valued query, dropping empties so
// `?filter=` doesn't travel through pagination as a meaningless key.
export function toSearchParams(
  raw: Record<string, string | string[] | undefined>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const single = firstValue(value);
    if (single) params.set(key, single);
  }
  return params;
}

// `?filter=` arrives as an arbitrary string; anything unrecognised means unfiltered.
export function parseIntersectionFilter(
  value: string | null | undefined
): IntersectionFilter | undefined {
  return value === "needs-content" ? value : undefined;
}

// Seeds from the request's own query so every active param survives paging —
// dropping `filter` here would page into the unfiltered list under filtered
// bounds. Takes a query string rather than a URLSearchParams instance so this
// still works if Pagination ever becomes a Client Component (class instances
// don't cross the RSC serialization boundary).
export function intersectionPageHref(page: number, query: string): string {
  const params = new URLSearchParams(query);
  params.set("page", String(page));
  return `/admin/intersections?${params}`;
}

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
      // (lib/trace.ts creates them in a loop), and offset pagination would
      // otherwise repeat or skip tied rows across page boundaries.
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
