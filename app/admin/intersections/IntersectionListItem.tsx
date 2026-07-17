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

  const hasText = item.text !== null && item.text.trim().length > 0;
  const hasImage = item._count.images > 0;

  return (
    <li>
      <Link
        href={`/admin/intersections/${item.id}`}
        className="block text-sm hover:opacity-70"
      >
        <span className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">#{item.id}</span>
          {hasText && (
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400" title="has text" />
          )}
          {hasImage && (
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400" title="has image" />
          )}
        </span>
        <span className="text-zinc-900">
          {formatDate(item.tracePointA.snapshot.fetchedAt)} ×{" "}
          {formatDate(item.tracePointB.snapshot.fetchedAt)}
        </span>
        <span className="block text-zinc-500 mt-0.5">
          {preview ?? "—"}
        </span>
      </Link>
    </li>
  );
}
