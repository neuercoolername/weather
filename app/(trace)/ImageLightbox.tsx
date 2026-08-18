import type { IntersectionImage } from "@/lib/server/data/intersections";
import ImageFrame from "@/components/ImageFrame";

// Fullscreen overlay for a single image; the backdrop (but not the image) closes it.
export default function ImageLightbox({
  image,
  onClose,
}: {
  image: IntersectionImage;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      <ImageFrame
        src={image.signedUrl}
        width={image.width}
        height={image.height}
        eager
        // Height is definite so the box reserves its space before the image loads;
        // inside a centering flex, max-h/max-w alone would shrink-wrap the empty image.
        frameClassName="relative h-[90vh] max-w-[92vw]"
        className="object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
