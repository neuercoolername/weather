import { getIntersectionPage } from "@/lib/admin/intersections";
import AdminNav from "@/app/admin/AdminNav";
import IntersectionList from "./IntersectionList";
import Pagination from "./Pagination";

export const dynamic = "force-dynamic";

export default async function IntersectionsListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { items, totalPages } = await getIntersectionPage(page);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <AdminNav />
      <IntersectionList items={items} />
      <Pagination page={page} totalPages={totalPages} />
    </div>
  );
}
