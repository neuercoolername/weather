import Link from "next/link";
import {
  intersectionPageHref,
  type IntersectionFilter,
} from "@/lib/admin/intersections";

export default function Pagination({
  page,
  totalPages,
  filter,
}: {
  page: number;
  totalPages: number;
  filter?: IntersectionFilter;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex gap-6 mt-10 text-sm text-zinc-500">
      {page > 1 && (
        <Link
          href={intersectionPageHref(page - 1, filter)}
          className="hover:text-zinc-900"
        >
          ← newer
        </Link>
      )}
      {page < totalPages && (
        <Link
          href={intersectionPageHref(page + 1, filter)}
          className="hover:text-zinc-900"
        >
          older →
        </Link>
      )}
    </div>
  );
}
