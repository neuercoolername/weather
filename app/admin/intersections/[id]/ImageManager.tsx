import type { IntersectionImage } from "@/lib/server/data/intersections";
import ImageItem from "./ImageItem";
import ImageUploadForm from "./ImageUploadForm";

export default function ImageManager({
  intersectionId,
  initialImages,
}: {
  intersectionId: number;
  initialImages: IntersectionImage[];
}) {
  return (
    <div className="space-y-6">
      {initialImages.length === 0 && (
        <p className="text-sm text-zinc-400">no images</p>
      )}
      {initialImages.map((img) => (
        <ImageItem key={img.id} intersectionId={intersectionId} image={img} />
      ))}
      <ImageUploadForm intersectionId={intersectionId} />
    </div>
  );
}
