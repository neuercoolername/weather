import type { IntersectionImage } from "@/lib/server/data/intersections";

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
        <img
          key={img.id}
          src={img.signedUrl}
          alt=""
          className="w-full max-h-[60vh] object-contain cursor-pointer"
          onClick={() => onExpand(img)}
        />
      ))}
    </div>
  );
}
