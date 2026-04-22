import Link from "next/link";

export default function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex gap-6 mt-10 text-sm text-zinc-500">
      {page > 1 && (
        <Link
          href={`/admin/intersections?page=${page - 1}`}
          className="hover:text-zinc-900"
        >
          ← newer
        </Link>
      )}
      {page < totalPages && (
        <Link
          href={`/admin/intersections?page=${page + 1}`}
          className="hover:text-zinc-900"
        >
          older →
        </Link>
      )}
    </div>
  );
}
