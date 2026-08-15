import type { IntersectionImage } from "@/lib/intersections";

// The intersection's image list; clicking one asks the parent to expand it.
export default function IntersectionImages({
  images,
  onExpand,
}: {
  images: IntersectionImage[];
  onExpand: (image: IntersectionImage) => void;
}) {
  return (
    <div className="space-y-4">
      {images.map((img) => (
        <figure key={img.id} className="space-y-1">
          <img
            src={img.signedUrl}
            alt={img.caption ?? ""}
            className="w-full max-h-[60vh] object-contain cursor-pointer"
            onClick={() => onExpand(img)}
          />
          {img.caption && (
            <figcaption className="text-xs text-zinc-400">{img.caption}</figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
