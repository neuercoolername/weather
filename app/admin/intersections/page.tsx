import Link from "next/link";
import { getIntersectionPage, getIntersectionStats } from "@/lib/admin/intersections";
import AdminNav from "@/app/admin/AdminNav";
import IntersectionList from "./IntersectionList";
import Pagination from "./Pagination";

export const dynamic = "force-dynamic";

export default async function IntersectionsListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const { page: pageParam, filter: filterParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const filter = filterParam === "needs-text" ? "needs-text" as const : undefined;

  const [{ items, totalPages }, { total, needsText }] = await Promise.all([
    getIntersectionPage(page, filter),
    getIntersectionStats(),
  ]);

  const pct = total === 0 ? 0 : Math.round((needsText / total) * 100);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <AdminNav />

      <div className="flex items-center justify-between mb-6 text-xs text-zinc-400">
        <span>
          {needsText} of {total} need text ({pct}%)
        </span>
        {filter === "needs-text" ? (
          <Link href="/admin/intersections" className="underline hover:text-zinc-900">
            show all
          </Link>
        ) : (
          <Link href="/admin/intersections?filter=needs-text" className="underline hover:text-zinc-900">
            needs text
          </Link>
        )}
      </div>

      <IntersectionList items={items} />
      <Pagination page={page} totalPages={totalPages} />
    </div>
  );
}
