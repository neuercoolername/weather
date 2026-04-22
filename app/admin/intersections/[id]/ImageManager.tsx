import ImageItem from "./ImageItem";
import ImageUploadForm from "./ImageUploadForm";

interface ImageRow {
  id: string;
  storageKey: string;
  caption: string | null;
  signedUrl: string;
}

export default function ImageManager({
  intersectionId,
  initialImages,
}: {
  intersectionId: number;
  initialImages: ImageRow[];
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
