import Link from "next/link";
import { intersectionPageHref } from "@/lib/admin/intersections";

export default function Pagination({
  page,
  totalPages,
  query,
}: {
  page: number;
  totalPages: number;
  query: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex gap-6 mt-10 text-sm text-zinc-500">
      {page > 1 && (
        <Link
          href={intersectionPageHref(page - 1, query)}
          className="hover:text-zinc-900"
        >
          ← newer
        </Link>
      )}
      {page < totalPages && (
        <Link
          href={intersectionPageHref(page + 1, query)}
          className="hover:text-zinc-900"
        >
          older →
        </Link>
      )}
    </div>
  );
}
