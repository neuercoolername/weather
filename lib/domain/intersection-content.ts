// One definition of "has something to show": written text, or at least one image.
// Takes primitives rather than an intersection object so this stays pure domain logic
// with no knowledge of the persistence shape — and so it works equally on the trace
// (an images array) and the admin list (an `_count.images` number).
//
// The admin queue encodes the inverse of this as a Prisma where clause
// (NEEDS_CONTENT in lib/admin/intersections.ts) — keep the two in step.
export function hasContent(text: string | null, imageCount: number): boolean {
  return !!text?.trim() || imageCount > 0;
}
