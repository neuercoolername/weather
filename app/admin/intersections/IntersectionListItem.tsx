import Link from "next/link";
import { formatDate } from "@/lib/email";
import type { IntersectionListItem } from "@/lib/admin/intersections";

export default function IntersectionListItem({
  item,
}: {
  item: IntersectionListItem;
}) {
  const preview = item.text
    ? item.text.length > 80
      ? item.text.slice(0, 80) + "…"
      : item.text
    : null;

  return (
    <li>
      <Link
        href={`/admin/intersections/${item.id}`}
        className="block text-sm hover:opacity-70"
      >
        <span className="text-zinc-900">
          {formatDate(item.tracePointA.snapshot.fetchedAt)} ×{" "}
          {formatDate(item.tracePointB.snapshot.fetchedAt)}
        </span>
        <span className="block text-zinc-500 mt-0.5">
          {preview ?? "—"}
          {item._count.images > 0 && (
            <>
              {" "}
              · {item._count.images}{" "}
              {item._count.images === 1 ? "image" : "images"}
            </>
          )}
        </span>
      </Link>
    </li>
  );
}
