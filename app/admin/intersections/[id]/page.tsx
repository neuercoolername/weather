import Link from "next/link";
import { notFound } from "next/navigation";
import { getIntersectionWithImages } from "@/lib/intersections";
import { formatDate } from "@/lib/email";
import TextEditor from "./TextEditor";
import ImageManager from "./ImageManager";

export const dynamic = "force-dynamic";

export default async function IntersectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const intersection = await getIntersectionWithImages(Number(id));
  if (!intersection) notFound();

  const imagesWithUrls = intersection.images;

  const dateA = intersection.tracePointA.snapshot.fetchedAt;
  const dateB = intersection.tracePointB.snapshot.fetchedAt;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-10 space-y-1 text-sm text-zinc-500">
        <Link href="/admin/intersections" className="hover:text-zinc-900">
          ← intersections
        </Link>
      </div>

      <div className="mb-8 space-y-1 text-sm text-zinc-500">
        <p>
          {formatDate(dateA)} × {formatDate(dateB)}
        </p>
        <p>
          ({intersection.x.toFixed(4)}, {intersection.y.toFixed(4)})
        </p>
        <Link href="/trace" className="hover:text-zinc-900 underline">
          view on trace
        </Link>
      </div>

      <div className="mb-10">
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">Text</p>
        <TextEditor
          intersectionId={intersection.id}
          initialText={intersection.text}
        />
      </div>

      <div>
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-4">Images</p>
        <ImageManager
          intersectionId={intersection.id}
          initialImages={imagesWithUrls}
        />
      </div>
    </div>
  );
}
