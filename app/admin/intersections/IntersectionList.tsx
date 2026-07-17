import type { IntersectionListItem as Item } from "@/lib/admin/intersections";
import IntersectionListItem from "./IntersectionListItem";

export default function IntersectionList({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">no intersections yet</p>;
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <IntersectionListItem key={item.id} item={item} />
      ))}
    </ul>
  );
}
