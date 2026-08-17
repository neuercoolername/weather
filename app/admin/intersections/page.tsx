import Link from "next/link";
import {
  getIntersectionPage,
  getIntersectionStats,
} from "@/lib/server/data/admin-intersections";
import {
  parseIntersectionFilter,
  toSearchParams,
} from "@/lib/domain/intersection-query";
import AdminNav from "@/app/admin/AdminNav";
import IntersectionList from "./IntersectionList";
import Pagination from "./Pagination";

export default async function IntersectionsListPage(
  props: PageProps<"/admin/intersections">
) {
  const params = toSearchParams(await props.searchParams);
  const page = Math.max(1, Number(params.get("page")) || 1);
  const filter = parseIntersectionFilter(params.get("filter"));

  const [{ items, totalPages }, { total, needsContent }] = await Promise.all([
    getIntersectionPage(page, filter),
    getIntersectionStats(),
  ]);

  const pct = total === 0 ? 0 : Math.round((needsContent / total) * 100);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <AdminNav />

      <div className="flex items-center justify-between mb-6 text-xs text-zinc-400">
        <span>
          {needsContent} of {total} need text or image ({pct}%)
        </span>
        {filter === "needs-content" ? (
          <Link href="/admin/intersections" className="underline hover:text-zinc-900">
            show all
          </Link>
        ) : (
          <Link href="/admin/intersections?filter=needs-content" className="underline hover:text-zinc-900">
            needs content
          </Link>
        )}
      </div>

      <IntersectionList items={items} />
      <Pagination page={page} totalPages={totalPages} query={params.toString()} />
    </div>
  );
}
