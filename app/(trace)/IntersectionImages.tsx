import type { IntersectionImage } from "@/lib/server/data/intersections";
import ImageFrame from "@/components/ImageFrame";

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
      {images.map((img, i) => (
        <ImageFrame
          key={img.id}
          src={img.signedUrl}
          width={img.width}
          height={img.height}
          // Opening the panel is the request for its first image; the rest can wait.
          eager={i === 0}
          frameClassName="relative w-full max-h-[60vh]"
          className="object-contain cursor-pointer max-h-[60vh]"
          onClick={() => onExpand(img)}
        />
      ))}
    </div>
  );
}
