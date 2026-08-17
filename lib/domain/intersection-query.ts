// Pure URL-state helpers for the admin intersection queue: parsing Next's raw
// searchParams into a well-defined query, and building paging hrefs from it.
// Kept free of Prisma so the components that build links can import it safely —
// the queries these feed live in lib/server/data/admin-intersections.

export type IntersectionFilter = "needs-content";

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
